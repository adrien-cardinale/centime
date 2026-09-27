import { budgets, categories, type Db, rules, transactions } from "@centime/db"
import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"
import { createTestAccount, createTestDb, insertTestTransactions } from "../test-support/database"
import { createCategoryRoutes } from "./categories"

let db: Db

async function insertCategory(name: string, parentId: string | null = null): Promise<string> {
  const [row] = await db.insert(categories).values({ name, color: "#4a84c4", parentId }).returning({ id: categories.id })
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
    const response = await createCategoryRoutes(db).request("/")
    expect(await response.json()).toMatchObject([{ id: food, transactionCount: 2 }])
  })

  it("soft deletes a category and detaches every reference", async () => {
    const parent = await insertCategory("Parent")
    const child = await insertCategory("Enfant", parent)
    const accountId = await createTestAccount(db)
    const [transactionId] = await insertTestTransactions(db, accountId, [{ rawLabel: "Achat", categoryId: parent }])
    const [rule] = await db
      .insert(rules)
      .values({ pattern: "achat", matchKind: "contains", field: "raw_label", categoryId: parent })
      .returning({ id: rules.id })
    await db.insert(budgets).values({ categoryId: parent, amount: 100, period: "monthly", startDate: "2026-01-01" })

    const response = await createCategoryRoutes(db).request(`/${parent}`, { method: "DELETE" })
    expect(response.status).toBe(200)

    const storedParent = await db.query.categories.findFirst({ where: eq(categories.id, parent) })
    const storedChild = await db.query.categories.findFirst({ where: eq(categories.id, child) })
    const storedTransaction = await db.query.transactions.findFirst({ where: eq(transactions.id, transactionId ?? "") })
    const storedRule = await db.query.rules.findFirst({ where: eq(rules.id, rule?.id ?? "") })
    const storedBudget = await db.query.budgets.findFirst()
    expect(storedParent?.deletedAt).not.toBeNull()
    expect(storedChild?.parentId).toBeNull()
    expect(storedTransaction?.categoryId).toBeNull()
    expect(storedRule?.categoryId).toBeNull()
    expect(storedBudget?.deletedAt).not.toBeNull()
  })

  it("returns 404 when deleting twice", async () => {
    const id = await insertCategory("Temporaire")
    const routes = createCategoryRoutes(db)
    await routes.request(`/${id}`, { method: "DELETE" })
    expect((await routes.request(`/${id}`, { method: "DELETE" })).status).toBe(404)
  })

  it("refuses a parent cycle", async () => {
    const parent = await insertCategory("Parent")
    const child = await insertCategory("Enfant", parent)
    const response = await createCategoryRoutes(db).request(
      `/${parent}`,
      json("PUT", { name: "Parent", color: "#4a84c4", parentId: child }),
    )
    expect(response.status).toBe(400)
  })

  it("rejects an invalid color with a readable message", async () => {
    const response = await createCategoryRoutes(db).request("/", json("POST", { name: "Test", color: "bleu" }))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: expect.stringContaining("hexadécimale") })
  })
})
