import {
  categories,
  csvProfiles,
  type DbExecutor,
  rules,
  seedDefaultCategories,
  seedDefaultCsvProfiles,
  seedDefaultRules,
  SYNC_TABLES,
} from "@centime/db"
import { count, isNull } from "@centime/db/orm"

const DEFAULT_DATA_TIMESTAMP = "2000-01-01T00:00:00.000Z"

export type DefaultDataCounts = { categories: number; rules: number; csvProfiles: number }

async function rowCount(db: DbExecutor, table: typeof categories | typeof rules | typeof csvProfiles): Promise<number> {
  const [row] = await db.select({ total: count() }).from(table)
  return row?.total ?? 0
}

export async function countDefaultData(db: DbExecutor): Promise<DefaultDataCounts> {
  return {
    categories: await rowCount(db, categories),
    rules: await rowCount(db, rules),
    csvProfiles: await rowCount(db, csvProfiles),
  }
}

export function lacksDefaultData(counts: DefaultDataCounts): boolean {
  return counts.categories === 0 || counts.rules === 0 || counts.csvProfiles === 0
}

export async function createDefaultData(db: DbExecutor): Promise<void> {
  const options = { timestamp: DEFAULT_DATA_TIMESTAMP }
  await seedDefaultCategories(db, options)
  await seedDefaultRules(db, options)
  await seedDefaultCsvProfiles(db, options)
}

export async function countPendingChanges(db: DbExecutor): Promise<number> {
  let total = 0
  for (const { table } of SYNC_TABLES) {
    const [row] = await db.select({ pending: count() }).from(table).where(isNull(table.syncVersion))
    total += row?.pending ?? 0
  }
  return total
}
