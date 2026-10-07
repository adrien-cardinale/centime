import { budgets, categories, type Db, rules, themes, transactions } from "@centime/db"
import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "bun:test"
import { createTestAccount, createTestDb, insertTestTransactions, withErrorHandling } from "../test-support/database"
import { createCategoryRoutes } from "./categories"

let db: Db

async function insertCategory(name: string, themeId: string | null = null): Promise<string> {
  const [row] = await db.insert(categories).values({ name, color: "#4a84c4", themeId }).returning({ id: categories.id })
  if (!row) throw new Error("Catégorie de test impossible à créer")
  return row.id
}

function json(method: string, body: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
}

beforeEach(async () => {
  db = await createTestDb()
})

describe("category routes", () => {
  it("lists active categories with their transaction count", async () => {
    const food = await insertCategory("Alimentation")
    const accountId = await createTestAccount(db)
    await insertTestTransactions(db, accountId, [
      { rawLabel: "Achat Épicerie", categoryId: food },
      { rawLabel: "Achat Marché", categoryId: food },
    ])
    const response = await withErrorHandling(createCategoryRoutes(db)).request("/")
    expect(await response.json()).toMatchObject([{ id: food, transactionCount: 2 }])
  })

  it("soft deletes a category and detaches every reference", async () => {
    const parent = await insertCategory("Parent")
    const accountId = await createTestAccount(db)
    const [transactionId] = await insertTestTransactions(db, accountId, [{ rawLabel: "Achat", categoryId: parent }])
    const [rule] = await db
      .insert(rules)
      .values({ pattern: "achat", matchKind: "contains", field: "raw_label", categoryId: parent })
      .returning({ id: rules.id })
    await db.insert(budgets).values({ categoryId: parent, amount: 100, period: "monthly", startDate: "2026-01-01" })

    const response = await withErrorHandling(createCategoryRoutes(db)).request(`/${parent}`, { method: "DELETE" })
    expect(response.status).toBe(200)

    const storedParent = await db.query.categories.findFirst({ where: eq(categories.id, parent) })
    const storedTransaction = await db.query.transactions.findFirst({ where: eq(transactions.id, transactionId ?? "") })
    const storedRule = await db.query.rules.findFirst({ where: eq(rules.id, rule?.id ?? "") })
    const storedBudget = await db.query.budgets.findFirst()
    expect(storedParent?.deletedAt).not.toBeNull()
    expect(storedTransaction?.categoryId).toBeNull()
    expect(storedRule?.categoryId).toBeNull()
    expect(storedBudget?.deletedAt).not.toBeNull()
  })

  it("returns 404 when deleting twice", async () => {
    const id = await insertCategory("Temporaire")
    const routes = withErrorHandling(createCategoryRoutes(db))
    await routes.request(`/${id}`, { method: "DELETE" })
    expect((await routes.request(`/${id}`, { method: "DELETE" })).status).toBe(404)
  })

  it("assigns a category to a theme and refuses an unknown one", async () => {
    const [theme] = await db.insert(themes).values({ name: "Maison", color: "#4a84c4" }).returning({ id: themes.id })
    const routes = withErrorHandling(createCategoryRoutes(db))
    const created = await routes.request("/", json("POST", { name: "Énergie", color: "#4a84c4", themeId: theme?.id }))
    expect(created.status).toBe(201)
    expect(await created.json()).toMatchObject({ name: "Énergie", themeId: theme?.id })
    const unknown = await routes.request("/", json("POST", { name: "Orpheline", color: "#4a84c4", themeId: "inconnu" }))
    expect(unknown.status).toBe(400)
  })

  it("rejects an invalid color with a readable message", async () => {
    const response = await withErrorHandling(createCategoryRoutes(db)).request("/", json("POST", { name: "Test", color: "bleu" }))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: expect.stringContaining("hexadécimale") })
  })
})
