import { sql } from "drizzle-orm"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { Database, type SQLQueryBindings } from "bun:sqlite"
import { describe, expect, it } from "bun:test"
import { readMigrationFolder, renderMigrationsModule } from "../scripts/migration-files"
import { createProxyDb, type Db, type ProxyExecutor } from "./client"
import { MIGRATIONS, migrationStatements, runMigrations } from "./migrations"
import { createDb } from "./node"
import { accounts, apiTokens, categories, themes } from "./schema"

const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url))
const generatedFile = fileURLToPath(new URL("./migrations.generated.ts", import.meta.url))

function bunSqliteExecutor(database: Database): ProxyExecutor {
  return async (query, params, method) => {
    const statement = database.prepare(query)
    const args = params as SQLQueryBindings[]
    if (method === "run") {
      statement.run(...args)
      return { rows: [] }
    }
    const rows = statement.values(...args)
    return { rows: method === "get" ? (rows[0] ?? []) : rows }
  }
}

async function appliedTags(db: Db): Promise<string[]> {
  const rows = await db.values<[string]>(sql`select tag from __centime_migrations order by tag`)
  return rows.map((row) => String(row[0]))
}

async function simulateDrizzleMigratedDatabase(db: Db, count: number): Promise<void> {
  for (const migration of MIGRATIONS.slice(0, count)) {
    for (const statement of migrationStatements(migration)) await db.run(sql.raw(statement))
  }
  await db.run(
    sql`create table __drizzle_migrations (id integer primary key autoincrement, hash text not null, created_at numeric)`,
  )
  for (const migration of MIGRATIONS.slice(0, count)) {
    await db.run(sql`insert into __drizzle_migrations (hash, created_at) values ('hash', ${migration.when})`)
  }
}

describe("bundled migrations", () => {
  it("match the drizzle folder", () => {
    const expected = readMigrationFolder(migrationsFolder)
    expect(MIGRATIONS).toEqual(expected)
    expect(readFileSync(generatedFile, "utf8")).toBe(renderMigrationsModule(expected))
  })
})

describe("runMigrations", () => {
  it("migrates an empty database through the proxy driver", async () => {
    const db = createProxyDb(bunSqliteExecutor(new Database(":memory:")))
    await runMigrations(db)
    await runMigrations(db)
    expect(await appliedTags(db)).toEqual(MIGRATIONS.map((migration) => migration.tag))
    const [account] = await db
      .insert(accounts)
      .values({ name: "Compte", kind: "bank", identifier: "CH00" })
      .returning()
    expect(account?.syncVersion).toBeNull()
    expect(await db.query.accounts.findFirst()).toMatchObject({ identifier: "CH00" })
    expect(await db.query.apiTokens.findFirst()).toBeUndefined()
  })

  it("adopts the history of a database migrated by drizzle", async () => {
    const db = createDb(":memory:")
    const alreadyApplied = MIGRATIONS.length - 1
    await simulateDrizzleMigratedDatabase(db, alreadyApplied)
    const createdAt = "2026-01-01T00:00:00.000Z"
    await db.run(
      sql`insert into accounts (id, created_at, updated_at, name, kind, identifier)
          values (${"a1"}, ${createdAt}, ${createdAt}, ${"Existant"}, ${"bank"}, ${"CH01"})`,
    )

    await runMigrations(db)

    expect(await appliedTags(db)).toEqual(MIGRATIONS.map((migration) => migration.tag))
    expect(await db.select().from(apiTokens)).toEqual([])
    expect(await db.select({ syncVersion: accounts.syncVersion }).from(accounts)).toEqual([{ syncVersion: null }])
  })

  it("turns parent categories into themes", async () => {
    const db = createDb(":memory:")
    await simulateDrizzleMigratedDatabase(db, MIGRATIONS.length - 1)
    const stamp = "2026-01-01T00:00:00.000Z"
    const insert = (id: string, name: string, parentId: string | null) =>
      db.run(
        sql`insert into categories (id, created_at, updated_at, name, color, parent_id)
            values (${id}, ${stamp}, ${stamp}, ${name}, ${"#4a84c4"}, ${parentId})`,
      )
    await insert("food", "Alimentation", null)
    await insert("groceries", "Courses", "food")
    await insert("bakery", "Boulangerie", "groceries")
    await insert("housing", "Logement", null)
    await insert("rent", "Loyer", "housing")
    await insert("leisure", "Loisirs", null)
    await db.run(
      sql`insert into rules (id, created_at, updated_at, pattern, match_kind, field, category_id, mark_as_transfer, priority)
          values (${"r1"}, ${stamp}, ${stamp}, ${"logement"}, ${"contains"}, ${"raw_label"}, ${"housing"}, 0, 0)`,
    )

    await runMigrations(db)

    expect((await db.select({ id: themes.id, name: themes.name }).from(themes)).sort((a, b) => a.id.localeCompare(b.id))).toEqual([
      { id: "food", name: "Alimentation" },
      { id: "housing", name: "Logement" },
    ])
    const rows = new Map((await db.select().from(categories)).map((row) => [row.id, row]))
    expect(rows.get("groceries")).toMatchObject({ themeId: "food", deletedAt: null })
    expect(rows.get("bakery")).toMatchObject({ themeId: "food", deletedAt: null })
    expect(rows.get("rent")).toMatchObject({ themeId: "housing", deletedAt: null })
    expect(rows.get("food")?.deletedAt).not.toBeNull()
    expect(rows.get("housing")).toMatchObject({ themeId: "housing", deletedAt: null })
    expect(rows.get("leisure")).toMatchObject({ themeId: null, deletedAt: null })
  })
})
