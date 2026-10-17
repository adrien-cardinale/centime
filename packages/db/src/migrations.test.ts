import { sql } from "drizzle-orm"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { Database, type SQLQueryBindings } from "bun:sqlite"
import { describe, expect, it } from "bun:test"
import { readMigrationFolder, renderMigrationsModule } from "../scripts/migration-files"
import { createProxyDb, type Db, type ProxyExecutor } from "./client"
import { MIGRATIONS, migrationStatements, runMigrations } from "./migrations"
import { createDb } from "./node"
import { accounts, apiTokens, budgets, categories, rules, themes, transactions } from "./schema"

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
    const [account] = await db.insert(accounts).values({ name: "Compte", kind: "bank", identifier: "CH00" }).returning()
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
    await simulateDrizzleMigratedDatabase(
      db,
      MIGRATIONS.findIndex((migration) => migration.tag === "0006_drop_category_parent"),
    )
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

    expect(
      (await db.select({ id: themes.id, name: themes.name }).from(themes)).sort((a, b) => a.id.localeCompare(b.id)),
    ).toEqual([
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

  it("turns fixed items into budgets, one category each", async () => {
    const db = createDb(":memory:")
    await simulateDrizzleMigratedDatabase(
      db,
      MIGRATIONS.findIndex((migration) => migration.tag === "0010_category_plans"),
    )
    const stamp = "2026-01-01T00:00:00.000Z"
    const later = "2026-02-01T00:00:00.000Z"
    await db.run(
      sql`insert into themes (id, created_at, updated_at, name, color) values (${"home"}, ${stamp}, ${stamp}, ${"Maison"}, ${"#3f6fae"})`,
    )
    const insertCategory = (id: string, name: string) =>
      db.run(
        sql`insert into categories (id, created_at, updated_at, name, color, theme_id)
            values (${id}, ${stamp}, ${stamp}, ${name}, ${"#cc6666"}, ${"home"})`,
      )
    await insertCategory("rent", "Loyer")
    await insertCategory("insurance", "Assurances")
    await insertCategory("energy", "Énergie")
    const insertItem = (id: string, name: string, categoryId: string | null, createdAt: string) =>
      db.run(
        sql`insert into fixed_items (id, created_at, updated_at, name, expected_amount, periodicity, category_id, start_date)
            values (${id}, ${createdAt}, ${createdAt}, ${name}, ${-100}, ${"monthly"}, ${categoryId}, ${"2026-01-01"})`,
      )
    await insertItem("item-rent", "Loyer", "rent", stamp)
    await insertItem("item-health", "Assurance maladie", "insurance", stamp)
    await insertItem("item-home", "Assurance ménage", "insurance", later)
    await insertItem("item-power", "Électricité", "energy", stamp)
    await insertItem("item-phone", "Téléphone", null, stamp)
    await insertCategory("salary", "Salaire")
    await db.run(
      sql`insert into fixed_items (id, created_at, updated_at, name, expected_amount, periodicity, due_day, category_id, start_date)
          values (${"item-salary"}, ${stamp}, ${stamp}, ${"Salaire"}, ${5000}, ${"monthly"}, ${25}, ${"salary"}, ${"2026-01-01"})`,
    )
    await db.run(
      sql`insert into budgets (id, created_at, updated_at, category_id, amount, period, start_date)
          values (${"b1"}, ${stamp}, ${stamp}, ${"energy"}, ${50}, ${"monthly"}, ${"2026-01-01"})`,
    )
    await db.run(sql`insert into accounts (id, created_at, updated_at, name, kind, identifier)
                     values (${"a1"}, ${stamp}, ${stamp}, ${"Compte"}, ${"bank"}, ${"CH01"})`)
    const insertTransaction = (id: string, categoryId: string | null, fixedItemId: string | null) =>
      db.run(
        sql`insert into transactions (id, created_at, updated_at, account_id, booking_date, raw_label, amount, currency, status, category_id, fixed_item_id, fingerprint)
            values (${id}, ${stamp}, ${stamp}, ${"a1"}, ${"2026-01-05"}, ${id}, ${-100}, ${"CHF"}, ${"booked"}, ${categoryId}, ${fixedItemId}, ${id})`,
      )
    await insertTransaction("t-rent", null, "item-rent")
    await insertTransaction("t-home", "insurance", "item-home")
    await insertTransaction("t-power", "energy", "item-power")
    await insertTransaction("t-other", "energy", null)
    const insertRule = (id: string, categoryId: string | null, fixedItemId: string | null) =>
      db.run(
        sql`insert into rules (id, created_at, updated_at, pattern, match_kind, field, category_id, fixed_item_id, mark_as_transfer, priority)
            values (${id}, ${stamp}, ${stamp}, ${id}, ${"contains"}, ${"raw_label"}, ${categoryId}, ${fixedItemId}, 0, 60)`,
      )
    await insertRule("r-phone", null, "item-phone")
    await insertRule("r-home", "insurance", "item-home")
    await insertRule("r-orphan", null, null)

    await runMigrations(db)

    const plans = new Map((await db.select().from(budgets)).map((row) => [row.id, row]))
    expect(Object.fromEntries([...plans].map(([id, row]) => [id, row.categoryId]))).toEqual({
      b1: "energy",
      "item-rent": "rent",
      "item-health": "insurance",
      "item-home": "item-home",
      "item-power": "item-power",
      "item-phone": "item-phone",
      "item-salary": "salary",
    })
    expect(plans.get("item-salary")).toMatchObject({ kind: "income", amount: 5000 })
    expect(plans.get("b1")).toMatchObject({ kind: "envelope" })
    expect(plans.get("item-rent")).toMatchObject({ kind: "envelope", amount: 100, period: "monthly", rollover: false })
    const created = new Map((await db.select().from(categories)).map((row) => [row.id, row]))
    expect(created.get("item-home")).toMatchObject({ name: "Assurance ménage", themeId: "home", color: "#cc6666" })
    expect(created.get("item-power")).toMatchObject({ name: "Électricité", themeId: "home" })
    expect(created.get("item-phone")).toMatchObject({ name: "Téléphone", themeId: null, color: "#4a84c4" })
    const moved = new Map((await db.select().from(transactions)).map((row) => [row.id, row.categoryId]))
    expect(Object.fromEntries(moved)).toEqual({
      "t-rent": "rent",
      "t-home": "item-home",
      "t-power": "item-power",
      "t-other": "energy",
    })
    const ruleRows = new Map((await db.select().from(rules)).map((row) => [row.id, row]))
    expect(ruleRows.get("r-phone")).toMatchObject({ categoryId: "item-phone", deletedAt: null })
    expect(ruleRows.get("r-home")).toMatchObject({ categoryId: "item-home", deletedAt: null })
    expect(ruleRows.get("r-orphan")?.deletedAt).not.toBeNull()
  })
})
