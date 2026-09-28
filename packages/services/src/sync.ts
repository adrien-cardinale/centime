import {
  type Db,
  type DbExecutor,
  settings,
  SYNC_TABLES,
  type SyncRow,
  type SyncTableEntry,
  type SyncTableName,
} from "@centime/db"
import { and, asc, eq, getTableColumns, gt, inArray, lte, max, ne, sql } from "drizzle-orm"
import type { SQLiteColumn } from "drizzle-orm/sqlite-core"
import { ServiceError } from "./errors"
import { type PushedChanges, type PushedRow, SYNC_ROW_SCHEMAS } from "./sync-schemas"

export const DEFAULT_PULL_LIMIT = 5000

const SEQUENCE_KEY = "sync_seq"
const ID_CHUNK_SIZE = 500

export type SyncChanges = { [Name in SyncTableName]: SyncRow[] }
export type AcceptedRow = { id: string; syncVersion: number | null }

export type PullInput = { since: number; limit?: number | undefined }
export type PullResult = { cursor: number; hasMore: boolean; changes: SyncChanges }

export type PushInput = { changes: { [Name in SyncTableName]?: unknown[] } }
export type PushResult = {
  cursor: number
  accepted: { [Name in SyncTableName]: AcceptedRow[] }
  rejected: SyncChanges
}

type AnyPushedRow = PushedRow<SyncTableName>
type MergeOutcome = { accepted: true } | { accepted: false; serverRow: SyncRow }
type TablePage = { name: SyncTableName; rows: SyncRow[]; truncatedAt: number | null }

function emptyChanges<Value>(): { [Name in SyncTableName]: Value[] } {
  return Object.fromEntries(SYNC_TABLES.map((entry) => [entry.name, []])) as unknown as {
    [Name in SyncTableName]: Value[]
  }
}

function columnsOf(entry: SyncTableEntry): Record<string, SQLiteColumn> {
  return getTableColumns(entry.table)
}

async function readSequence(db: DbExecutor): Promise<number> {
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, SEQUENCE_KEY))
  return row ? Number(row.value) : 0
}

async function writeSequence(db: DbExecutor, sequence: number): Promise<void> {
  const value = String(sequence)
  await db
    .insert(settings)
    .values({ key: SEQUENCE_KEY, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } })
}

async function stampTable(db: DbExecutor, entry: SyncTableEntry, base: number): Promise<number> {
  const { table } = entry
  await db.run(sql`
    update ${table} set sync_version = ${base} + numbered.position
    from (
      select id, row_number() over (order by updated_at, id) as position
      from ${table} where sync_version is null
    ) as numbered
    where ${table}.id = numbered.id`)
  const [row] = await db.select({ highest: max(table.syncVersion) }).from(table)
  return Math.max(base, row?.highest ?? 0)
}

export async function stampUnversionedRows(db: Db): Promise<number> {
  return db.transaction(async (tx) => {
    const start = await readSequence(tx)
    let sequence = start
    for (const entry of SYNC_TABLES) sequence = await stampTable(tx, entry, sequence)
    if (sequence > start) await writeSequence(tx, sequence)
    return sequence
  })
}

type PageWindow = { since: number; head: number; limit: number }

async function readPage(db: DbExecutor, entry: SyncTableEntry, { since, head, limit }: PageWindow): Promise<TablePage> {
  const { table } = entry
  const rows: SyncRow[] = await db
    .select()
    .from(table)
    .where(and(gt(table.syncVersion, since), lte(table.syncVersion, head)))
    .orderBy(asc(table.syncVersion), asc(table.id))
    .limit(limit + 1)
  if (rows.length <= limit) return { name: entry.name, rows, truncatedAt: null }
  const page = rows.slice(0, limit)
  return { name: entry.name, rows: page, truncatedAt: page.at(-1)?.syncVersion ?? since }
}

function pageCursor(pages: TablePage[], head: number): number {
  return pages.reduce((cursor, page) => (page.truncatedAt === null ? cursor : Math.min(cursor, page.truncatedAt)), head)
}

export async function pullChanges(db: Db, { since, limit = DEFAULT_PULL_LIMIT }: PullInput): Promise<PullResult> {
  const head = await stampUnversionedRows(db)
  const pages: TablePage[] = []
  for (const entry of SYNC_TABLES) pages.push(await readPage(db, entry, { since, head, limit }))
  const cursor = pageCursor(pages, head)
  const changes = emptyChanges<SyncRow>()
  for (const page of pages) changes[page.name] = page.rows.filter((row) => (row.syncVersion ?? 0) <= cursor)
  return { cursor, hasMore: cursor < head, changes }
}

function parseTableRows(name: SyncTableName, rows: unknown[]): AnyPushedRow[] {
  const parsed = SYNC_ROW_SCHEMAS[name].array().safeParse(rows)
  if (parsed.success) return parsed.data
  const issue = parsed.error.issues[0]
  throw new ServiceError(`Ligne invalide dans ${name} : ${issue?.path.join(".") ?? ""} ${issue?.message ?? ""}`.trim())
}

function parsePushedChanges(changes: PushInput["changes"]): PushedChanges {
  const parsed: { [Name in SyncTableName]?: AnyPushedRow[] } = {}
  for (const [name, rows] of Object.entries(changes)) {
    if (!(name in SYNC_ROW_SCHEMAS)) throw new ServiceError(`Table inconnue : ${name}`)
    if (rows !== undefined) parsed[name as SyncTableName] = parseTableRows(name as SyncTableName, rows)
  }
  return parsed as PushedChanges
}

async function findById(db: DbExecutor, entry: SyncTableEntry, id: string): Promise<SyncRow | undefined> {
  const [row] = await db.select().from(entry.table).where(eq(entry.table.id, id))
  return row
}

async function findUniqueConflict(db: DbExecutor, entry: SyncTableEntry, row: AnyPushedRow): Promise<SyncRow | undefined> {
  const columns = columnsOf(entry)
  const values: Record<string, unknown> = row
  for (const key of entry.uniqueKeys) {
    const column = columns[key]
    if (!column) continue
    const [conflict] = await db
      .select()
      .from(entry.table)
      .where(and(eq(column, values[key]), ne(entry.table.id, row.id)))
    if (conflict) return conflict
  }
  return undefined
}

function isNewer(row: AnyPushedRow, serverRow: SyncRow): boolean {
  return Date.parse(row.updatedAt) > Date.parse(serverRow.updatedAt)
}

async function writeRow(db: DbExecutor, entry: SyncTableEntry, row: AnyPushedRow, existing: SyncRow | undefined) {
  const { table } = entry
  if (!existing) {
    await db.insert(table).values({ ...row, syncVersion: null } as typeof table.$inferInsert)
    return
  }
  const values = { ...row, createdAt: existing.createdAt, syncVersion: null }
  await db
    .update(table)
    .set(values as typeof table.$inferInsert)
    .where(eq(table.id, row.id))
}

async function mergeRow(db: DbExecutor, entry: SyncTableEntry, row: AnyPushedRow): Promise<MergeOutcome> {
  const existing = await findById(db, entry, row.id)
  if (existing && !isNewer(row, existing)) return { accepted: false, serverRow: existing }
  const conflict = await findUniqueConflict(db, entry, row)
  if (conflict) return { accepted: false, serverRow: conflict }
  await writeRow(db, entry, row, existing)
  return { accepted: true }
}

type MergeSummary = { acceptedIds: { [Name in SyncTableName]: string[] }; rejected: SyncChanges }

async function mergeChanges(db: DbExecutor, changes: PushedChanges): Promise<MergeSummary> {
  const acceptedIds = emptyChanges<string>()
  const rejected = emptyChanges<SyncRow>()
  await db.run(sql`pragma defer_foreign_keys = on`)
  for (const entry of SYNC_TABLES) {
    const rows: AnyPushedRow[] = changes[entry.name] ?? []
    for (const row of rows) {
      const outcome = await mergeRow(db, entry, row)
      if (outcome.accepted) acceptedIds[entry.name].push(row.id)
      else rejected[entry.name].push(outcome.serverRow)
    }
  }
  return { acceptedIds, rejected }
}

async function loadVersions(db: DbExecutor, entry: SyncTableEntry, ids: string[]): Promise<AcceptedRow[]> {
  const { table } = entry
  const versions: AcceptedRow[] = []
  for (let start = 0; start < ids.length; start += ID_CHUNK_SIZE) {
    const chunk = ids.slice(start, start + ID_CHUNK_SIZE)
    versions.push(
      ...(await db.select({ id: table.id, syncVersion: table.syncVersion }).from(table).where(inArray(table.id, chunk))),
    )
  }
  return versions
}

export async function pushChanges(db: Db, input: PushInput): Promise<PushResult> {
  const changes = parsePushedChanges(input.changes)
  return db.transaction(async (tx) => {
    const { acceptedIds, rejected } = await mergeChanges(tx, changes)
    const cursor = await stampUnversionedRows(tx)
    const accepted = emptyChanges<AcceptedRow>()
    for (const entry of SYNC_TABLES) accepted[entry.name] = await loadVersions(tx, entry, acceptedIds[entry.name])
    return { cursor, accepted, rejected }
  })
}
