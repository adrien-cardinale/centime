import { type Db, type DbExecutor, SYNC_TABLES, type SyncRow, type SyncTableEntry, type SyncTableName } from "@centime/db"
import { SYNC_ROW_SCHEMAS } from "@centime/services"
import { and, asc, gt, isNull, sql } from "@centime/db/orm"
import { z } from "zod"
import i18n from "@/i18n"
import type { Vault } from "../crypto/envelope"
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

export type SyncErrorKind = "unauthorized" | "network" | "server"

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
})

const pushResponseSchema = z.object({ seq: z.number().int().min(1) })

const payloadSchema = z.object({ v: z.number().int(), changes: tableRowsSchema })

type TableRows = z.infer<typeof tableRowsSchema>
type PushBatch = { changes: Partial<Record<SyncTableName, SyncRow[]>>; rowCount: number }
type PushCursorState = { exhausted: Set<SyncTableName>; lastIds: Map<SyncTableName, string> }

type SyncContext = { db: Db; config: SyncConfig; exclusive: Exclusive }

const REQUEST_TIMEOUT_MS = 15_000

const runDirectly: Exclusive = (task) => task()

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

async function send(config: SyncConfig, path: string, init: RequestInit): Promise<Response> {
  try {
    return await config.fetch(`${normalizeServerUrl(config.serverUrl)}${path}`, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch {
    throw new SyncError(i18n.t("syncErrors.network"), "network")
  }
}

function authorizationOf(config: SyncConfig): string {
  const { userId, secret } = config.vault.credentials
  return `Bearer ${userId}.${secret}`
}

async function ensureOk(response: Response): Promise<void> {
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

/**
 * Le secret d'accès au serveur et la clé de chiffrement dérivent du même secret maître : si le serveur nous a
 * authentifiés, une entrée illisible est corrompue ou écrite par une version plus récente de l'app. On l'ignore
 * en avançant le curseur plutôt que de bloquer définitivement la synchronisation de tous les appareils.
 */
async function decodeEntry(vault: Vault, entry: { seq: number; data: string }): Promise<DecodedEntry | null> {
  try {
    const payload = payloadSchema.parse(JSON.parse(await vault.decryptText(entry.data)))
    if (payload.v !== PAYLOAD_VERSION) {
      console.warn(`Synchronisation : entrée ${entry.seq} écrite en version ${payload.v}, ignorée`)
      return null
    }
    return { seq: entry.seq, changes: payload.changes }
  } catch {
    console.warn(`Synchronisation : entrée ${entry.seq} illisible, ignorée`)
    return null
  }
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

async function pullPage(context: SyncContext, since: number) {
  const path = `/api/log?since=${since}&limit=${context.config.pullPageSize ?? PULL_PAGE_SIZE}`
  const page = await requestJson(context.config, path, { method: "GET" }, pullResponseSchema)
  const decoded: DecodedEntry[] = []
  let skipped = 0
  for (const entry of page.entries) {
    const result = await decodeEntry(context.config.vault, entry)
    if (result) decoded.push(result)
    else skipped += 1
  }
  let applied = 0
  await context.exclusive(() =>
    context.db.transaction(async (tx) => {
      await tx.run(sql`pragma defer_foreign_keys = on`)
      for (const entry of decoded) {
        const outcome = await applyEntry(tx, entry)
        applied += outcome.applied
        skipped += outcome.skipped
      }
      await writeSyncSetting(tx, "cursor", page.cursor)
    }),
  )
  return { ...page, applied, skipped }
}

type PullSummary = { cursor: number; pulled: number; skipped: number }

async function pullAll(context: SyncContext, since: number): Promise<PullSummary> {
  let cursor = since
  let pulled = 0
  let skipped = 0
  for (;;) {
    const page = await pullPage(context, cursor)
    pulled += page.applied
    skipped += page.skipped
    if (page.hasMore && page.cursor <= cursor) throw new SyncError(i18n.t("syncErrors.invalidResponse"), "server")
    cursor = page.cursor
    if (!page.hasMore) return { cursor, pulled, skipped }
  }
}

async function readTableBatch(db: DbExecutor, entry: SyncTableEntry, afterId: string, limit: number): Promise<SyncRow[]> {
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
  const { seq } = await requestJson(context.config, "/api/log", { method: "POST", body }, pushResponseSchema)
  const contiguous = !summary.missedChanges && seq === summary.cursor + 1
  await context.exclusive(() =>
    context.db.transaction(async (tx) => {
      await stampBatch(tx, batch, seq)
      if (contiguous) await writeSyncSetting(tx, "cursor", seq)
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
  const { cursor: storedCursor } = await context.exclusive(() => readSyncSettings(context.db))
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
  const context: SyncContext = { db, config, exclusive: config.exclusive ?? runDirectly }
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
