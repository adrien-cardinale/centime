import { type DbExecutor, type SyncRow, type SyncTableEntry, transactions } from "@centime/db"
import type { PushedRow } from "@centime/services"
import { and, eq, getTableColumns, isNull, ne, sql } from "@centime/db/orm"
import type { SQLiteColumn } from "@centime/db/orm"

export type IncomingRow = PushedRow<SyncTableEntry["name"]>
export type ApplyMode = "pull" | "overwrite"
export type StampedRow = { id: string; syncVersion: number | null; updatedAt: string }

async function findLocal(db: DbExecutor, entry: SyncTableEntry, id: string): Promise<SyncRow | undefined> {
  const [row] = await db.select().from(entry.table).where(eq(entry.table.id, id))
  return row
}

function incomingVersion(row: IncomingRow): number | null {
  return row.syncVersion ?? null
}

function keepsLocal(local: SyncRow, incoming: IncomingRow): boolean {
  if (local.syncVersion !== null && local.syncVersion === incomingVersion(incoming)) return true
  return local.syncVersion === null && Date.parse(local.updatedAt) > Date.parse(incoming.updatedAt)
}

async function reassignTransactions(db: DbExecutor, fromAccountId: string, toAccountId: string): Promise<void> {
  await db.update(transactions).set({ accountId: toAccountId }).where(eq(transactions.accountId, fromAccountId))
}

async function removeUnsyncedCollisions(db: DbExecutor, entry: SyncTableEntry, row: IncomingRow): Promise<void> {
  const { table } = entry
  const columns: Record<string, SQLiteColumn> = getTableColumns(table)
  const values: Record<string, unknown> = row
  for (const key of entry.uniqueKeys) {
    const column = columns[key]
    if (!column) continue
    const collisions = await db
      .select({ id: table.id })
      .from(table)
      .where(and(eq(column, values[key]), ne(table.id, row.id), isNull(table.syncVersion)))
    for (const collision of collisions) {
      if (entry.name === "accounts") await reassignTransactions(db, collision.id, row.id)
      await db.delete(table).where(eq(table.id, collision.id))
    }
  }
}

async function writeIncoming(db: DbExecutor, entry: SyncTableEntry, row: IncomingRow, exists: boolean): Promise<void> {
  const { table } = entry
  const values = { ...row, syncVersion: incomingVersion(row) } as typeof table.$inferInsert
  if (exists) await db.update(table).set(values).where(eq(table.id, row.id))
  else await db.insert(table).values(values)
}

export async function applyIncomingRow(
  db: DbExecutor,
  entry: SyncTableEntry,
  row: IncomingRow,
  mode: ApplyMode,
): Promise<boolean> {
  const local = await findLocal(db, entry, row.id)
  if (local && mode === "pull" && keepsLocal(local, row)) return false
  await removeUnsyncedCollisions(db, entry, row)
  await writeIncoming(db, entry, row, local !== undefined)
  return true
}

export async function stampAcceptedRow(db: DbExecutor, entry: SyncTableEntry, row: StampedRow): Promise<void> {
  if (row.syncVersion === null) return
  await db.run(
    sql`update ${entry.table} set sync_version = ${row.syncVersion}
        where id = ${row.id} and updated_at = ${row.updatedAt} and sync_version is null`,
  )
}
