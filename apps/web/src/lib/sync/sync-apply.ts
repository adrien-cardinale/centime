import { type DbExecutor, settings, type SyncRow, type SyncTableEntry, transactions } from "@centime/db"
import type { PushedRow } from "@centime/services"
import { and, eq, getTableColumns, ne, sql } from "@centime/db/orm"
import type { SQLiteColumn } from "@centime/db/orm"

export type IncomingRow = PushedRow<SyncTableEntry["name"]>
export type StampedRow = { id: string; syncVersion: number | null; updatedAt: string }

const ALIAS_PREFIX = "sync_alias:"

async function findLocal(db: DbExecutor, entry: SyncTableEntry, id: string): Promise<SyncRow | undefined> {
  const [row] = await db.select().from(entry.table).where(eq(entry.table.id, id))
  return row
}

function incomingVersion(row: IncomingRow): number | null {
  return row.syncVersion ?? null
}

/**
 * Le serveur ne voit que des blobs chiffrés : c'est le client qui arbitre. La ligne la plus récente gagne, même
 * si la version locale est déjà synchronisée, ce qui empêche aussi un serveur de rejouer une entrée périmée.
 */
function keepsLocal(local: SyncRow, incoming: IncomingRow): boolean {
  if (local.syncVersion !== null && local.syncVersion === incomingVersion(incoming)) return true
  return Date.parse(local.updatedAt) > Date.parse(incoming.updatedAt)
}

async function readAlias(db: DbExecutor, id: string): Promise<string | null> {
  const [row] = await db
    .select()
    .from(settings)
    .where(eq(settings.key, `${ALIAS_PREFIX}${id}`))
  return row?.value ?? null
}

async function writeAlias(db: DbExecutor, loserId: string, winnerId: string): Promise<void> {
  const key = `${ALIAS_PREFIX}${loserId}`
  await db.insert(settings).values({ key, value: winnerId }).onConflictDoUpdate({ target: settings.key, set: { value: winnerId } })
}

async function reassignTransactions(db: DbExecutor, fromAccountId: string, toAccountId: string): Promise<void> {
  await db.update(transactions).set({ accountId: toAccountId }).where(eq(transactions.accountId, fromAccountId))
}

async function removeLoser(db: DbExecutor, entry: SyncTableEntry, loserId: string, winnerId: string): Promise<void> {
  if (entry.name === "accounts") {
    await reassignTransactions(db, loserId, winnerId)
    await writeAlias(db, loserId, winnerId)
  }
  await db.delete(entry.table).where(eq(entry.table.id, loserId))
}

/**
 * Deux appareils peuvent créer le même compte (ou importer la même transaction) hors ligne. Le plus petit id gagne
 * partout, et une ligne locale non synchronisée cède toujours son id : tous les appareils convergent vers la même
 * ligne. Si la ligne locale sacrifiée est plus récente (modifiée hors ligne), son contenu survit sous l'id gagnant
 * et reste à re-pousser, pour converger sans perdre les modifications de l'utilisateur.
 */
async function resolveCollisions(db: DbExecutor, entry: SyncTableEntry, row: IncomingRow): Promise<IncomingRow | "skip"> {
  const { table } = entry
  const columns: Record<string, SQLiteColumn> = getTableColumns(table)
  const values: Record<string, unknown> = row
  let winner = row
  for (const key of entry.uniqueKeys) {
    const column = columns[key]
    if (!column) continue
    const collisions: SyncRow[] = await db
      .select()
      .from(table)
      .where(and(eq(column, values[key]), ne(table.id, row.id)))
    for (const collision of collisions) {
      const incomingLoses = collision.syncVersion !== null && collision.id < row.id
      if (incomingLoses) {
        if (entry.name === "accounts") await writeAlias(db, row.id, collision.id)
        return "skip"
      }
      if (collision.syncVersion === null && Date.parse(collision.updatedAt) > Date.parse(winner.updatedAt)) {
        winner = { ...collision, id: row.id, syncVersion: null } as IncomingRow
      }
      await removeLoser(db, entry, collision.id, row.id)
    }
  }
  return winner
}

async function remapReferences(db: DbExecutor, entry: SyncTableEntry, row: IncomingRow): Promise<IncomingRow> {
  if (entry.name !== "transactions") return row
  const transaction = row as PushedRow<"transactions">
  const alias = await readAlias(db, transaction.accountId)
  return alias === null ? row : ({ ...transaction, accountId: alias } as IncomingRow)
}

async function writeIncoming(db: DbExecutor, entry: SyncTableEntry, row: IncomingRow, exists: boolean): Promise<void> {
  const { table } = entry
  const values = { ...row, syncVersion: incomingVersion(row) } as typeof table.$inferInsert
  if (exists) await db.update(table).set(values).where(eq(table.id, row.id))
  else await db.insert(table).values(values)
}

export async function applyIncomingRow(db: DbExecutor, entry: SyncTableEntry, incoming: IncomingRow): Promise<boolean> {
  const row = await remapReferences(db, entry, incoming)
  const local = await findLocal(db, entry, row.id)
  if (local && keepsLocal(local, row)) return false
  const resolved = await resolveCollisions(db, entry, row)
  if (resolved === "skip") return false
  await writeIncoming(db, entry, resolved, local !== undefined)
  return true
}

export async function stampAcceptedRow(db: DbExecutor, entry: SyncTableEntry, row: StampedRow): Promise<void> {
  if (row.syncVersion === null) return
  await db.run(
    sql`update ${entry.table} set sync_version = ${row.syncVersion}
        where id = ${row.id} and updated_at = ${row.updatedAt} and sync_version is null`,
  )
}
