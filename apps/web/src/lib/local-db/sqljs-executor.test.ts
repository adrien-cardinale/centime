import { createProxyDb, type Db, runMigrations, SYNC_TABLES } from "@centime/db"
import { apiSurface, ServiceError } from "@centime/services"
import initSqlJs from "sql.js"
import { beforeEach, describe, expect, it } from "bun:test"
import { countDefaultData, countPendingChanges, createDefaultData, lacksDefaultData } from "./local-data"
import { applyConnectionPragmas, createSqlJsExecutor, isWriteStatement } from "./sqljs-executor"

const writes: string[] = []
let db: Db

beforeEach(async () => {
  writes.length = 0
  const SQL = await initSqlJs()
  const database = new SQL.Database()
  applyConnectionPragmas(database)
  db = createProxyDb(
    createSqlJsExecutor(database, (sql) => {
      if (isWriteStatement(sql)) writes.push(sql)
    }),
  )
  await runMigrations(db)
})

describe("sql.js executor", () => {
  it("runs the shared services on the local database", async () => {
    const account = await apiSurface.accounts.create(db, {
      name: "Compte courant",
      kind: "bank",
      identifier: "CH9300762011623852957",
      currency: "CHF",
    })
    await expect(
      apiSurface.accounts.create(db, { name: "Doublon", kind: "bank", identifier: account.identifier, currency: "CHF" }),
    ).rejects.toBeInstanceOf(ServiceError)
    await apiSurface.categories.create(db, { name: "Loisirs", color: "#c46a9e" })

    expect(await apiSurface.accounts.list(db)).toHaveLength(1)
    expect((await apiSurface.categories.list(db)).map((category) => category.name)).toEqual(["Loisirs"])
    expect(await apiSurface.dashboard.overview(db, { date: "2026-03-15" })).toBeDefined()
  })

  it("reports write statements so the file can be saved", async () => {
    writes.length = 0
    await apiSurface.categories.create(db, { name: "Santé", color: "#cc6666" })
    await apiSurface.categories.list(db)

    expect(writes.some((sql) => sql.startsWith("insert"))).toBe(true)
    expect(writes.every((sql) => !/^\s*select/i.test(sql))).toBe(true)
  })

  it("creates default data stamped so that server rows always win", async () => {
    expect(lacksDefaultData(await countDefaultData(db))).toBe(true)

    await createDefaultData(db)

    expect(lacksDefaultData(await countDefaultData(db))).toBe(false)
    const [category] = await db.select().from(SYNC_TABLES[1].table)
    expect(category?.updatedAt).toBe("2000-01-01T00:00:00.000Z")
    expect(await countPendingChanges(db)).toBeGreaterThan(0)
  })
})
