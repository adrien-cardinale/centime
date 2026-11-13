import {
  type Db,
  type DbExecutor,
  SYNC_TABLES,
  type SyncRow,
  type SyncTableEntry,
  type SyncTableName,
} from "@centime/db"
import { SYNC_ROW_SCHEMAS } from "@centime/services"
import { and, asc, gt, isNull, sql } from "@centime/db/orm"
import { z } from "zod"
import i18n from "@/i18n"
import type { Vault } from "../crypto/envelope"
import { markAllChangesPending } from "../local-db/local-data"
import { applyIncomingRow, type IncomingRow, stampAcceptedRow } from "./sync-apply"
import { clearSyncSetting, readSyncSettings, writeSyncSetting } from "./sync-settings"

export const PUSH_BATCH_SIZE = 500
export const PULL_PAGE_SIZE = 100
const PAYLOAD_VERSION = 1

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>
export type Exclusive = <Result>(task: () => Promise<Result>) => Promise<Result>

export type SyncConfig = {
  serverUrl: string
  vault: Vault
  fetch: FetchLike
  exclusive?: Exclusive | undefined
  pushBatchSize?: number | undefined
  pullPageSize?: number | undefined
}

export type SyncReport = { pulled: number; pushed: number; cursor: number; skipped: number }

export type SyncErrorKind = "unauthorized" | "network" | "server" | "outdated"

export class SyncError extends Error {
  constructor(
    message: string,
    readonly kind: SyncErrorKind,
  ) {
    super(message)
  }
}

const tableRowsSchema = z.record(z.string(), z.array(z.unknown()))

const pullResponseSchema = z.object({
  cursor: z.number().int().min(0),
  hasMore: z.boolean(),
  entries: z.array(z.object({ seq: z.number().int().min(1), data: z.string() })),
  head: z.number().int().min(0).optional(),
  epoch: z.string().nullable().optional(),
})

const pushResponseSchema = z.object({ seq: z.number().int().min(1), epoch: z.string().nullable().optional() })

const payloadSchema = z.object({ v: z.number().int(), changes: tableRowsSchema })

type TableRows = z.infer<typeof tableRowsSchema>
type PushBatch = { changes: Partial<Record<SyncTableName, SyncRow[]>>; rowCount: number }
type PushCursorState = { exhausted: Set<SyncTableName>; lastIds: Map<SyncTableName, string> }

type PulledPage = z.infer<typeof pullResponseSchema>
type ServerIdentity = { epoch: string | null; resetDone: boolean }
type SyncContext = { db: Db; config: SyncConfig; exclusive: Exclusive; identity: ServerIdentity }

const REQUEST_TIMEOUT_MS = 15_000

export const runDirectly: Exclusive = (task) => task()

export function normalizeServerUrl(serverUrl: string): string {
  return serverUrl.trim().replace(/\/+$/, "")
}

async function errorMessageOf(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json()
    if (body && typeof body === "object" && "error" in body && typeof body.error === "string") return body.error
  } catch {}
  return i18n.t("syncErrors.serverStatus", { status: response.status })
}

export async function send(config: SyncConfig, path: string, init: RequestInit): Promise<Response> {
  try {
    return await config.fetch(`${normalizeServerUrl(config.serverUrl)}${path}`, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch {
    throw new SyncError(i18n.t("syncErrors.network"), "network")
  }
}

export function authorizationOf(config: SyncConfig): string {
  const { userId, secret } = config.vault.credentials
  return `Bearer ${userId}.${secret}`
}

export async function ensureOk(response: Response): Promise<void> {
  if (response.status === 401) throw new SyncError(i18n.t("syncErrors.unauthorized"), "unauthorized")
  if (!response.ok) throw new SyncError(await errorMessageOf(response), "server")
}

export async function deleteAccount(config: SyncConfig): Promise<void> {
  const response = await send(config, "/api/account", {
    method: "DELETE",
    headers: { Authorization: authorizationOf(config) },
  })
  await ensureOk(response)
}

async function requestJson<Schema extends z.ZodType>(
  config: SyncConfig,
  path: string,
  init: RequestInit,
  schema: Schema,
): Promise<z.output<Schema>> {
  const headers = { Authorization: authorizationOf(config), "Content-Type": "application/json" }
  const response = await send(config, path, { ...init, headers })
  await ensureOk(response)
  const parsed = schema.safeParse(await response.json().catch(() => null))
  if (!parsed.success) throw new SyncError(i18n.t("syncErrors.invalidResponse"), "server")
  return parsed.data
}

type ParsedRows = { rows: IncomingRow[]; skipped: number }

function parseRows(entry: SyncTableEntry, rows: unknown[] | undefined): ParsedRows {
  const schema = SYNC_ROW_SCHEMAS[entry.name]
  const parsed: ParsedRows = { rows: [], skipped: 0 }
  for (const row of rows ?? []) {
    const result = schema.safeParse(row)
    if (result.success) parsed.rows.push(result.data)
    else parsed.skipped += 1
  }
  if (parsed.skipped > 0) {
    console.warn(`Synchronisation : ${parsed.skipped} ligne(s) « ${entry.name} » illisible(s), ignorée(s)`)
  }
  return parsed
}

type DecodedEntry = { seq: number; changes: TableRows }
type Decoded = { kind: "entry"; entry: DecodedEntry } | { kind: "unreadable" } | { kind: "newer" }

// Le serveur nous a authentifiés avec un secret dérivé de la même clé : une entrée indéchiffrable est corrompue.
// L'ignorer évite de bloquer la synchronisation pour toujours ; une version plus récente, elle, se lira après mise à jour.
async function decodeEntry(vault: Vault, entry: { seq: number; data: string }): Promise<Decoded> {
  let payload: z.infer<typeof payloadSchema>
  try {
    payload = payloadSchema.parse(JSON.parse(await vault.decryptText(entry.data)))
  } catch {
    console.warn(`Synchronisation : entrée ${entry.seq} illisible, ignorée`)
    return { kind: "unreadable" }
  }
  if (payload.v > PAYLOAD_VERSION) return { kind: "newer" }
  if (payload.v < PAYLOAD_VERSION) {
    console.warn(`Synchronisation : entrée ${entry.seq} écrite en version ${payload.v}, ignorée`)
    return { kind: "unreadable" }
  }
  return { kind: "entry", entry: { seq: entry.seq, changes: payload.changes } }
}

async function applyEntry(db: DbExecutor, entry: DecodedEntry): Promise<{ applied: number; skipped: number }> {
  let applied = 0
  let skipped = 0
  for (const table of SYNC_TABLES) {
    const parsed = parseRows(table, entry.changes[table.name])
    skipped += parsed.skipped
    for (const row of parsed.rows) {
      if (await applyIncomingRow(db, table, { ...row, syncVersion: entry.seq })) applied += 1
    }
  }
  return { applied, skipped }
}

type DecodedPage = { entries: DecodedEntry[]; skipped: number; cursor: number; blocked: boolean }

async function decodePage(vault: Vault, page: PulledPage, since: number): Promise<DecodedPage> {
  const decoded: DecodedPage = { entries: [], skipped: 0, cursor: since, blocked: false }
  for (const entry of page.entries) {
    const result = await decodeEntry(vault, entry)
    if (result.kind === "newer") return { ...decoded, blocked: true }
    if (result.kind === "entry") decoded.entries.push(result.entry)
    else decoded.skipped += 1
    decoded.cursor = entry.seq
  }
  return { ...decoded, cursor: page.cursor }
}

function serverWasReset(page: PulledPage, since: number, knownEpoch: string | null): boolean {
  if (page.head !== undefined && page.head < since) return true
  return page.epoch !== undefined && knownEpoch !== null && page.epoch !== knownEpoch
}

async function rememberEpoch(db: DbExecutor, identity: ServerIdentity, epoch: string | null | undefined) {
  if (epoch === undefined || epoch === identity.epoch) return
  if (epoch === null) await clearSyncSetting(db, "epoch")
  else await writeSyncSetting(db, "epoch", epoch)
  identity.epoch = epoch
}

async function restartFromScratch(context: SyncContext, epoch: string | null | undefined): Promise<void> {
  if (context.identity.resetDone) throw new SyncError(i18n.t("syncErrors.invalidResponse"), "server")
  console.warn("Synchronisation : le journal du serveur a été réinitialisé, renvoi de toutes les données locales")
  await context.exclusive(() =>
    context.db.transaction(async (tx) => {
      await markAllChangesPending(tx)
      await writeSyncSetting(tx, "cursor", 0)
      await rememberEpoch(tx, context.identity, epoch ?? null)
    }),
  )
  context.identity.resetDone = true
}

type PageOutcome =
  | { kind: "reset" }
  | { kind: "applied"; cursor: number; hasMore: boolean; applied: number; skipped: number; blocked: boolean }

async function pullPage(context: SyncContext, since: number): Promise<PageOutcome> {
  const path = `/api/log?since=${since}&limit=${context.config.pullPageSize ?? PULL_PAGE_SIZE}`
  const page = await requestJson(context.config, path, { method: "GET" }, pullResponseSchema)
  if (serverWasReset(page, since, context.identity.epoch)) {
    await restartFromScratch(context, page.epoch)
    return { kind: "reset" }
  }
  const decoded = await decodePage(context.config.vault, page, since)
  let applied = 0
  let skipped = decoded.skipped
  await context.exclusive(() =>
    context.db.transaction(async (tx) => {
      await tx.run(sql`pragma defer_foreign_keys = on`)
      for (const entry of decoded.entries) {
        const outcome = await applyEntry(tx, entry)
        applied += outcome.applied
        skipped += outcome.skipped
      }
      await writeSyncSetting(tx, "cursor", decoded.cursor)
      await rememberEpoch(tx, context.identity, page.epoch)
    }),
  )
  return { kind: "applied", cursor: decoded.cursor, hasMore: page.hasMore, applied, skipped, blocked: decoded.blocked }
}

type PullSummary = { cursor: number; pulled: number; skipped: number }

async function pullAll(context: SyncContext, since: number): Promise<PullSummary> {
  let cursor = since
  let pulled = 0
  let skipped = 0
  for (;;) {
    const page = await pullPage(context, cursor)
    if (page.kind === "reset") {
      cursor = 0
      continue
    }
    pulled += page.applied
    skipped += page.skipped
    if (page.blocked) throw new SyncError(i18n.t("syncErrors.updateRequired"), "outdated")
    if (page.hasMore && page.cursor <= cursor) throw new SyncError(i18n.t("syncErrors.invalidResponse"), "server")
    cursor = page.cursor
    if (!page.hasMore) return { cursor, pulled, skipped }
  }
}

async function readTableBatch(
  db: DbExecutor,
  entry: SyncTableEntry,
  afterId: string,
  limit: number,
): Promise<SyncRow[]> {
  const { table } = entry
  return db
    .select()
    .from(table)
    .where(and(isNull(table.syncVersion), gt(table.id, afterId)))
    .orderBy(asc(table.id))
    .limit(limit)
}

async function readPushBatch(db: DbExecutor, state: PushCursorState, size: number): Promise<PushBatch | null> {
  const batch: PushBatch = { changes: {}, rowCount: 0 }
  let total = 0
  for (const entry of SYNC_TABLES) {
    if (total >= size) break
    if (state.exhausted.has(entry.name)) continue
    const rows = await readTableBatch(db, entry, state.lastIds.get(entry.name) ?? "", size - total)
    if (rows.length < size - total) state.exhausted.add(entry.name)
    const last = rows.at(-1)
    if (!last) continue
    state.lastIds.set(entry.name, last.id)
    batch.changes[entry.name] = rows
    total += rows.length
    batch.rowCount = total
  }
  return total > 0 ? batch : null
}

type PushSummary = { cursor: number; pushed: number; missedChanges: boolean }

async function stampBatch(db: DbExecutor, batch: PushBatch, seq: number): Promise<void> {
  for (const entry of SYNC_TABLES) {
    for (const row of batch.changes[entry.name] ?? []) {
      await stampAcceptedRow(db, entry, { id: row.id, syncVersion: seq, updatedAt: row.updatedAt })
    }
  }
}

async function pushBatch(context: SyncContext, batch: PushBatch, summary: PushSummary): Promise<void> {
  const plain = JSON.stringify({ v: PAYLOAD_VERSION, changes: batch.changes })
  const body = JSON.stringify({ data: await context.config.vault.encryptText(plain) })
  const { seq, epoch } = await requestJson(context.config, "/api/log", { method: "POST", body }, pushResponseSchema)
  const contiguous = !summary.missedChanges && seq === summary.cursor + 1
  await context.exclusive(() =>
    context.db.transaction(async (tx) => {
      await stampBatch(tx, batch, seq)
      if (contiguous) await writeSyncSetting(tx, "cursor", seq)
      if (context.identity.epoch === null) await rememberEpoch(tx, context.identity, epoch)
    }),
  )
  summary.pushed += batch.rowCount
  if (contiguous) summary.cursor = seq
  else summary.missedChanges = true
}

async function pushAll(context: SyncContext, cursor: number): Promise<PushSummary> {
  const summary: PushSummary = { cursor, pushed: 0, missedChanges: false }
  const state: PushCursorState = { exhausted: new Set(), lastIds: new Map() }
  const size = context.config.pushBatchSize ?? PUSH_BATCH_SIZE
  for (;;) {
    const batch = await context.exclusive(() => readPushBatch(context.db, state, size))
    if (!batch) return summary
    await pushBatch(context, batch, summary)
  }
}

async function runSync(context: SyncContext): Promise<SyncReport> {
  const { cursor: storedCursor, epoch } = await context.exclusive(() => readSyncSettings(context.db))
  context.identity.epoch = epoch
  const pulled = await pullAll(context, storedCursor)
  const pushed = await pushAll(context, pulled.cursor)
  const report = { pulled: pulled.pulled, pushed: pushed.pushed, cursor: pushed.cursor, skipped: pulled.skipped }
  if (!pushed.missedChanges) return report
  const caughtUp = await pullAll(context, pushed.cursor)
  return {
    ...report,
    pulled: report.pulled + caughtUp.pulled,
    cursor: caughtUp.cursor,
    skipped: report.skipped + caughtUp.skipped,
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : i18n.t("syncErrors.unexpected")
}

export async function synchronize(db: Db, config: SyncConfig): Promise<SyncReport> {
  const context: SyncContext = {
    db,
    config,
    exclusive: config.exclusive ?? runDirectly,
    identity: { epoch: null, resetDone: false },
  }
  try {
    const report = await runSync(context)
    await context.exclusive(async () => {
      await writeSyncSetting(db, "lastAt", new Date().toISOString())
      await clearSyncSetting(db, "lastError")
    })
    return report
  } catch (error) {
    await context.exclusive(() => writeSyncSetting(db, "lastError", messageOf(error))).catch(() => undefined)
    throw error
  }
}
