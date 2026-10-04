import { budgets, categories, type Db, fixedItems } from "@centime/db"
import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "bun:test"
import type { budgetsOverview, BudgetEntry } from "@centime/services"
import { createTestAccount, createTestDb, insertTestTransactions, readJson, withErrorHandling } from "../test-support/database"
import { createBudgetRoutes } from "./budgets"

let db: Db
let accountId: string
let food: string

type Overview = Awaited<ReturnType<typeof budgetsOverview>>

const TODAY = new Date(2026, 8, 20)

function json(method: string, body: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
}

function routes() {
  return withErrorHandling(createBudgetRoutes(db, () => TODAY))
}

async function insertCategory(name: string, parentId: string | null = null): Promise<string> {
  const [row] = await db.insert(categories).values({ name, color: "#4a84c4", parentId }).returning({ id: categories.id })
  if (!row) throw new Error("Catégorie de test impossible à créer")
  return row.id
}

async function insertFixedItem(): Promise<string> {
  const [row] = await db
    .insert(fixedItems)
    .values({ name: "Abonnement fictif", expectedAmount: -800, periodicity: "monthly", startDate: "2026-01-01" })
    .returning({ id: fixedItems.id })
  if (!row) throw new Error("Poste fixe de test impossible à créer")
  return row.id
}

const foodBudget = { amount: 500, period: "monthly", rollover: true, startDate: "2026-08-01" }

beforeEach(async () => {
  db = await createTestDb()
  accountId = await createTestAccount(db)
  food = await insertCategory("Alimentation")
})

describe("budget routes", () => {
  it("creates a budget and rejects a second one for the same category", async () => {
    const first = await routes().request("/", json("POST", { ...foodBudget, categoryId: food }))
    expect(first.status).toBe(201)
    expect(await readJson<BudgetEntry>(first)).toMatchObject({ categoryId: food, categoryName: "Alimentation", amount: 500 })

    const second = await routes().request("/", json("POST", { ...foodBudget, categoryId: food }))
    expect(second.status).toBe(409)
  })

  it("rejects an unknown category", async () => {
    const response = await routes().request("/", json("POST", { ...foodBudget, categoryId: "inconnue" }))
    expect(response.status).toBe(404)
  })

  it("allows a new budget once the previous one is deleted", async () => {
    const created = await readJson<BudgetEntry>(await routes().request("/", json("POST", { ...foodBudget, categoryId: food })))
    expect((await routes().request(`/${created.id}`, { method: "DELETE" })).status).toBe(200)
    const [stored] = await db.select().from(budgets).where(eq(budgets.id, created.id))
    expect(stored?.deletedAt).not.toBeNull()
    expect((await routes().request("/", json("POST", { ...foodBudget, categoryId: food }))).status).toBe(201)
  })

  it("aggregates eligible spending with subcategories, rollover and pending amounts", async () => {
    const supermarket = await insertCategory("Supermarché", food)
    const leisure = await insertCategory("Loisirs")
    const subscription = await insertFixedItem()
    await db.insert(budgets).values({ ...foodBudget, period: "monthly", categoryId: food })
    await insertTestTransactions(db, accountId, [
      { rawLabel: "Courses juillet", categoryId: food, bookingDate: "2026-07-10", amount: -900 },
      { rawLabel: "Courses août", categoryId: food, bookingDate: "2026-08-12", amount: -300 },
      { rawLabel: "Supermarché septembre", categoryId: supermarket, bookingDate: "2026-09-05", amount: -100 },
      { rawLabel: "Remboursement", categoryId: food, bookingDate: "2026-09-06", amount: 20 },
      { rawLabel: "Virement épargne", categoryId: food, bookingDate: "2026-09-07", amount: -1000, isTransfer: true },
      { rawLabel: "Abonnement", categoryId: food, bookingDate: "2026-09-08", amount: -800, fixedItemId: subscription },
      { rawLabel: "Boulangerie", categoryId: food, bookingDate: "2026-09-18", amount: -40, status: "pending" },
      { rawLabel: "Cinéma", categoryId: leisure, bookingDate: "2026-09-09", amount: -60 },
    ])

    const response = await routes().request("/overview?date=2026-09-15")
    expect(response.status).toBe(200)
    const overview = await readJson<Overview>(response)
    const [item] = overview.budgets
    expect(item?.status).toMatchObject({
      range: { start: "2026-09-01", end: "2026-09-30", label: "Septembre 2026" },
      carry: 200,
      available: 700,
      spent: 80,
      pending: 40,
      remaining: 620,
      state: "ok",
      projected: 120,
    })
    expect(item?.history.map((period) => period.spent)).toEqual([0, 0, 0, 0, 900, 300])
    expect(item?.breakdown).toEqual([
      { categoryId: supermarket, categoryName: "Supermarché", categoryColor: "#4a84c4", spent: 100 },
      { categoryId: food, categoryName: "Alimentation", categoryColor: "#4a84c4", spent: -20 },
    ])
    expect(overview.totals.monthly).toEqual({ available: 700, spent: 80, remaining: 620 })
    expect(overview.envelopes).toEqual({ expected: 500, actual: 80 })
    expect(overview.unbudgeted).toEqual([
      { categoryId: leisure, categoryName: "Loisirs", categoryColor: "#4a84c4", spent: 60 },
    ])
  })

  it("defaults the overview to the clock date", async () => {
    await db.insert(budgets).values({ ...foodBudget, period: "monthly", rollover: false, categoryId: food })
    const overview = await readJson<Overview>(await routes().request("/overview"))
    expect(overview.date).toBe("2026-09-20")
    expect(overview.budgets[0]?.status).toMatchObject({ carry: 0, available: 500, spent: 0, state: "ok" })
  })
})
