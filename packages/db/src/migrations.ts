import { eq, sql } from "drizzle-orm"
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"
import type { Db } from "./client"
import { GENERATED_MIGRATIONS } from "./migrations.generated"

export type Migration = { tag: string; when: number; sql: string }

export const MIGRATIONS: readonly Migration[] = GENERATED_MIGRATIONS

const FOREIGN_KEYS_OFF = /PRAGMA foreign_keys\s*=\s*OFF/i
const STATEMENT_BREAKPOINT = "--> statement-breakpoint"

const appliedMigrations = sqliteTable("__centime_migrations", {
  tag: text("tag").primaryKey(),
  appliedAt: text("applied_at"),
})

const drizzleMigrations = sqliteTable("__drizzle_migrations", {
  id: integer("id").primaryKey(),
  createdAt: integer("created_at"),
})

const sqliteMaster = sqliteTable("sqlite_master", {
  type: text("type"),
  name: text("name"),
})

export function migrationStatements(migration: Migration): string[] {
  return migration.sql
    .split(STATEMENT_BREAKPOINT)
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0)
}

async function tableExists(db: Db, name: string): Promise<boolean> {
  const rows = await db.select({ name: sqliteMaster.name }).from(sqliteMaster).where(eq(sqliteMaster.name, name))
  return rows.length > 0
}

async function recordApplied(db: Db, tags: string[]): Promise<void> {
  if (tags.length === 0) return
  const appliedAt = new Date().toISOString()
  await db.insert(appliedMigrations).values(tags.map((tag) => ({ tag, appliedAt })))
}

async function adoptDrizzleHistory(db: Db, migrations: readonly Migration[]): Promise<string[]> {
  if (!(await tableExists(db, "accounts")) || !(await tableExists(db, "__drizzle_migrations"))) return []
  const history = await db.select({ createdAt: drizzleMigrations.createdAt }).from(drizzleMigrations)
  const appliedTimes = new Set(history.map((row) => Number(row.createdAt)))
  const adopted = migrations.filter((migration) => appliedTimes.has(migration.when)).map((migration) => migration.tag)
  await recordApplied(db, adopted)
  return adopted
}

async function loadAppliedTags(db: Db, migrations: readonly Migration[]): Promise<Set<string>> {
  await db.run(sql`create table if not exists ${appliedMigrations} (tag text primary key not null, applied_at text)`)
  const rows = await db.select({ tag: appliedMigrations.tag }).from(appliedMigrations)
  if (rows.length > 0) return new Set(rows.map((row) => row.tag))
  return new Set(await adoptDrizzleHistory(db, migrations))
}

// SQLite ignores PRAGMA foreign_keys inside a transaction: table rebuilds must switch it off beforehand.
async function applyMigration(db: Db, migration: Migration): Promise<void> {
  if (FOREIGN_KEYS_OFF.test(migration.sql)) await db.run(sql`PRAGMA foreign_keys=OFF`)
  await db.transaction(async (tx) => {
    for (const statement of migrationStatements(migration)) await tx.run(sql.raw(statement))
    await recordApplied(tx, [migration.tag])
  })
}

export async function runMigrations(db: Db, migrations: readonly Migration[] = MIGRATIONS): Promise<void> {
  const applied = await loadAppliedTags(db, migrations)
  for (const migration of migrations) {
    if (!applied.has(migration.tag)) await applyMigration(db, migration)
  }
}
