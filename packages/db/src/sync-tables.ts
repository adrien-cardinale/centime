import type { SQLiteTable } from "drizzle-orm/sqlite-core"
import { accounts, budgets, categories, csvProfiles, fixedItems, imports, rules, transactions } from "./schema"

type SyncTableDefinition<Name extends string, Table extends SQLiteTable> = {
  name: Name
  table: Table
  uniqueKeys: readonly (keyof Table["$inferSelect"] & string)[]
}

function syncTable<Name extends string, Table extends SQLiteTable>(
  name: Name,
  table: Table,
  uniqueKeys: readonly (keyof Table["$inferSelect"] & string)[] = [],
): SyncTableDefinition<Name, Table> {
  return { name, table, uniqueKeys }
}

export const SYNC_TABLES = [
  syncTable("accounts", accounts, ["identifier"]),
  syncTable("categories", categories),
  syncTable("csv_profiles", csvProfiles),
  syncTable("imports", imports),
  syncTable("fixed_items", fixedItems),
  syncTable("rules", rules),
  syncTable("budgets", budgets),
  syncTable("transactions", transactions, ["fingerprint"]),
] as const

export type SyncTableEntry = (typeof SYNC_TABLES)[number]
export type SyncTableName = SyncTableEntry["name"]
export type SyncTable = SyncTableEntry["table"]
export type SyncRow = SyncTable["$inferSelect"]

export const SYNC_TABLE_NAMES = SYNC_TABLES.map((entry) => entry.name)
