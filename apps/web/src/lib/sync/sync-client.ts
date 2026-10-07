import { type Db, type DbExecutor, SYNC_TABLES, type SyncRow, type SyncTableEntry, type SyncTableName } from "@centime/db"
import { SYNC_ROW_SCHEMAS } from "@centime/services"
import { and, asc, gt, isNull, sql } from "@centime/db/orm"
import { z } from "zod"
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

export type SyncReport = { pulled: number; pushed: number; cursor: number }

export type SyncErrorKind = "unauthorized" | "network" | "server"

export class SyncError extends Error {
  constructor(
    message: string,
    readonly kind: SyncErrorKind,
  ) {
    super(message)
  }
}

const UNAUTHORIZED_MESSAGE = "Accès refusé par le serveur : la clé ne correspond pas à ce compte"
const UNREADABLE_ENTRY_MESSAGE = "Une entrée du serveur est illisible : la clé ne correspond pas ou les données ont été altérées"
const NETWORK_MESSAGE = "Serveur injoignable : vérifie la connexion réseau et l'adresse du serveur"
const INVALID_RESPONSE_MESSAGE = "Réponse du serveur invalide"

const tableRowsSchema = z.record(z.string(), z.array(z.unknown()))

const pullResponseSchema = z.object({
  cursor: z.number().int().min(0),
  hasMore: z.boolean(),
  entries: z.array(z.object({ seq: z.number().int().min(1), data: z.string() })),
})

const pushResponseSchema = z.object({ seq: z.number().int().min(1) })

const payloadSchema = z.object({ v: z.literal(PAYLOAD_VERSION), changes: tableRowsSchema })

type TableRows = z.infer<typeof tableRowsSchema>
type PushBatch = { changes: Partial<Record<SyncTableName, SyncRow[]>>; rowCount: number }
type PushCursorState = { exhausted: Set<SyncTableName>; lastIds: Map<SyncTableName, string> }

type SyncContext = { db: Db; config: SyncConfig; exclusive: Exclusive }

const runDirectly: Exclusive = (task) => task()

export function normalizeServerUrl(serverUrl: string): string {
  return serverUrl.trim().replace(/\/+$/, "")
}

async function errorMessageOf(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json()
    if (body && typeof body === "object" && "error" in body && typeof body.error === "string") return body.error
  } catch {}
  return `Erreur du serveur (${response.status})`
}

async function send(config: SyncConfig, path: string, init: RequestInit): Promise<Response> {
  try {
    return await config.fetch(`${normalizeServerUrl(config.serverUrl)}${path}`, init)
  } catch {
    throw new SyncError(NETWORK_MESSAGE, "network")
  }
}

async function requestJson<Schema extends z.ZodType>(
  config: SyncConfig,
  path: string,
  init: RequestInit,
  schema: Schema,
): Promise<z.output<Schema>> {
  const { userId, secret } = config.vault.credentials
  const headers = { Authorization: `Bearer ${userId}.${secret}`, "Content-Type": "application/json" }
  const response = await send(config, path, { ...init, headers })
  if (response.status === 401) throw new SyncError(UNAUTHORIZED_MESSAGE, "unauthorized")
  if (!response.ok) throw new SyncError(await errorMessageOf(response), "server")
  const parsed = schema.safeParse(await response.json().catch(() => null))
  if (!parsed.success) throw new SyncError(INVALID_RESPONSE_MESSAGE, "server")
  return parsed.data
}

function parseRows(entry: SyncTableEntry, rows: unknown[] | undefined): IncomingRow[] {
  const parsed = SYNC_ROW_SCHEMAS[entry.name].array().safeParse(rows ?? [])
  if (!parsed.success) throw new SyncError(`${INVALID_RESPONSE_MESSAGE} (${entry.name})`, "server")
  return parsed.data
}

type DecodedEntry = { seq: number; changes: TableRows }

async function decodeEntry(vault: Vault, entry: { seq: number; data: string }): Promise<DecodedEntry> {
  try {
    const payload = payloadSchema.parse(JSON.parse(await vault.decryptText(entry.data)))
    return { seq: entry.seq, changes: payload.changes }
  } catch {
    throw new SyncError(UNREADABLE_ENTRY_MESSAGE, "server")
  }
}

async function applyEntry(db: DbExecutor, entry: DecodedEntry): Promise<number> {
  let applied = 0
  for (const table of SYNC_TABLES) {
    for (const row of parseRows(table, entry.changes[table.name])) {
      if (await applyIncomingRow(db, table, { ...row, syncVersion: entry.seq })) applied += 1
    }
  }
  return applied
}

async function pullPage(context: SyncContext, since: number) {
  const path = `/api/log?since=${since}&limit=${context.config.pullPageSize ?? PULL_PAGE_SIZE}`
  const page = await requestJson(context.config, path, { method: "GET" }, pullResponseSchema)
  const decoded: DecodedEntry[] = []
  for (const entry of page.entries) decoded.push(await decodeEntry(context.config.vault, entry))
  let applied = 0
  await context.exclusive(() =>
    context.db.transaction(async (tx) => {
      await tx.run(sql`pragma defer_foreign_keys = on`)
      for (const entry of decoded) applied += await applyEntry(tx, entry)
      await writeSyncSetting(tx, "cursor", page.cursor)
    }),
  )
  return { ...page, applied }
}

async function pullAll(context: SyncContext, since: number): Promise<{ cursor: number; pulled: number }> {
  let cursor = since
  let pulled = 0
  for (;;) {
    const page = await pullPage(context, cursor)
    pulled += page.applied
    if (page.hasMore && page.cursor <= cursor) throw new SyncError(INVALID_RESPONSE_MESSAGE, "server")
    cursor = page.cursor
    if (!page.hasMore) return { cursor, pulled }
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
  const report = { pulled: pulled.pulled, pushed: pushed.pushed, cursor: pushed.cursor }
  if (!pushed.missedChanges) return report
  const caughtUp = await pullAll(context, pushed.cursor)
  return { ...report, pulled: report.pulled + caughtUp.pulled, cursor: caughtUp.cursor }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Erreur de synchronisation inattendue"
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
