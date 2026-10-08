import { type DbExecutor, SYNC_TABLES } from "@centime/db"
import { count, isNull, sql } from "@centime/db/orm"

export async function countPendingChanges(db: DbExecutor): Promise<number> {
  let total = 0
  for (const { table } of SYNC_TABLES) {
    const [row] = await db.select({ pending: count() }).from(table).where(isNull(table.syncVersion))
    total += row?.pending ?? 0
  }
  return total
}

export async function markAllChangesPending(db: DbExecutor): Promise<void> {
  for (const { table } of SYNC_TABLES) await db.run(sql`update ${table} set sync_version = null`)
}
