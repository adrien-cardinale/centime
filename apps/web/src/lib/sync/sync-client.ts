import { type Db, type DbExecutor, SYNC_TABLES, type SyncRow, type SyncTableEntry, type SyncTableName } from "@centime/db"
import { SYNC_ROW_SCHEMAS } from "@centime/services"
import { and, asc, gt, isNull, sql } from "@centime/db/orm"
import { z } from "zod"
import { applyIncomingRow, type IncomingRow, stampAcceptedRow } from "./sync-apply"
import { clearSyncSetting, readSyncSettings, writeSyncSetting } from "./sync-settings"

export const PUSH_BATCH_SIZE = 500

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>
export type Exclusive = <Result>(task: () => Promise<Result>) => Promise<Result>

export type SyncConfig = {
  serverUrl: string
  token: string
  fetch: FetchLike
  exclusive?: Exclusive | undefined
  pushBatchSize?: number | undefined
}

export type SyncReport = { pulled: number; pushed: number; rejected: number; cursor: number }

export type SyncErrorKind = "unauthorized" | "network" | "server"

export class SyncError extends Error {
  constructor(
    message: string,
    readonly kind: SyncErrorKind,
  ) {
    super(message)
  }
}

const UNAUTHORIZED_MESSAGE = "Jeton refusé, reconnecte-toi"
const NETWORK_MESSAGE = "Serveur injoignable : vérifie la connexion réseau et l'adresse du serveur"
const INVALID_RESPONSE_MESSAGE = "Réponse du serveur invalide"

const tableRowsSchema = z.record(z.string(), z.array(z.unknown()))

const pullResponseSchema = z.object({
  cursor: z.number().int().min(0),
  hasMore: z.boolean(),
  changes: tableRowsSchema,
})

const acceptedRowSchema = z.object({ id: z.string(), syncVersion: z.number().int().nullable() })

const pushResponseSchema = z.object({
  cursor: z.number().int().min(0),
  accepted: z.record(z.string(), z.array(acceptedRowSchema)),
  rejected: tableRowsSchema,
})

type TableRows = z.infer<typeof tableRowsSchema>
type PushResponse = z.infer<typeof pushResponseSchema>
type PushBatch = { changes: Partial<Record<SyncTableName, SyncRow[]>>; updatedAtById: Map<string, string> }
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
  const headers = { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" }
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

async function applyRows(db: DbExecutor, rows: TableRows, mode: "pull" | "overwrite"): Promise<number> {
  let applied = 0
  for (const entry of SYNC_TABLES) {
    for (const row of parseRows(entry, rows[entry.name])) {
      await applyIncomingRow(db, entry, row, mode)
      applied += 1
    }
  }
  return applied
}

function countRows(rows: TableRows): number {
  return SYNC_TABLES.reduce((total, entry) => total + (rows[entry.name]?.length ?? 0), 0)
}

async function pullPage(context: SyncContext, since: number) {
  const page = await requestJson(context.config, `/api/sync/pull?since=${since}`, { method: "GET" }, pullResponseSchema)
  await context.exclusive(() =>
    context.db.transaction(async (tx) => {
      await tx.run(sql`pragma defer_foreign_keys = on`)
      await applyRows(tx, page.changes, "pull")
      await writeSyncSetting(tx, "cursor", page.cursor)
    }),
  )
  return page
}

async function pullAll(context: SyncContext, since: number): Promise<{ cursor: number; pulled: number }> {
  let cursor = since
  let pulled = 0
  for (;;) {
    const page = await pullPage(context, cursor)
    pulled += countRows(page.changes)
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
  const batch: PushBatch = { changes: {}, updatedAtById: new Map() }
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
    for (const row of rows) batch.updatedAtById.set(row.id, row.updatedAt)
    total += rows.length
  }
  return total > 0 ? batch : null
}

function acceptedVersions(response: PushResponse): number[] {
  return Object.values(response.accepted).flatMap((rows) => rows.flatMap((row) => row.syncVersion ?? []))
}

export function coversCursorGap(cursor: number, nextCursor: number, versions: number[]): boolean {
  const unique = new Set(versions)
  if (unique.size !== versions.length || unique.size !== nextCursor - cursor) return false
  return versions.every((version) => version > cursor && version <= nextCursor)
}

async function applyPushResponse(db: DbExecutor, batch: PushBatch, response: PushResponse): Promise<void> {
  await db.run(sql`pragma defer_foreign_keys = on`)
  for (const entry of SYNC_TABLES) {
    for (const accepted of response.accepted[entry.name] ?? []) {
      const updatedAt = batch.updatedAtById.get(accepted.id)
      if (updatedAt !== undefined) await stampAcceptedRow(db, entry, { ...accepted, updatedAt })
    }
  }
  await applyRows(db, response.rejected, "overwrite")
}

type PushSummary = { cursor: number; pushed: number; rejected: number; missedChanges: boolean }

async function pushBatch(context: SyncContext, batch: PushBatch, summary: PushSummary): Promise<void> {
  const body = JSON.stringify({ changes: batch.changes })
  const response = await requestJson(context.config, "/api/sync/push", { method: "POST", body }, pushResponseSchema)
  const contiguous = !summary.missedChanges && coversCursorGap(summary.cursor, response.cursor, acceptedVersions(response))
  await context.exclusive(() =>
    context.db.transaction(async (tx) => {
      await applyPushResponse(tx, batch, response)
      if (contiguous) await writeSyncSetting(tx, "cursor", response.cursor)
    }),
  )
  summary.pushed += acceptedVersions(response).length
  summary.rejected += countRows(response.rejected)
  if (contiguous) summary.cursor = response.cursor
  else summary.missedChanges = true
}

async function pushAll(context: SyncContext, cursor: number): Promise<PushSummary> {
  const summary: PushSummary = { cursor, pushed: 0, rejected: 0, missedChanges: false }
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
  const report = { pulled: pulled.pulled, pushed: pushed.pushed, rejected: pushed.rejected, cursor: pushed.cursor }
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
