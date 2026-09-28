import { categories, type Db, fixedItems, rules, transactions } from "@centime/db"
import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "bun:test"
import { z } from "zod"
import type { findFixedItem, fixedItemsOverview } from "@centime/services"
import { createTestAccount, createTestDb, insertTestTransactions, readJson, withErrorHandling } from "../test-support/database"
import { createFixedItemRoutes } from "./fixed-items"

let db: Db
let accountId: string
let housing: string

type Overview = Awaited<ReturnType<typeof fixedItemsOverview>>
type FixedItemEntry = NonNullable<Awaited<ReturnType<typeof findFixedItem>>>

const TODAY = new Date(2026, 2, 28)

function json(method: string, body: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
}

function routes() {
  return withErrorHandling(createFixedItemRoutes(db, () => TODAY))
}

const rentPayload = {
  name: "Loyer fictif",
  expectedAmount: -1500,
  periodicity: "monthly",
  dueDay: 25,
  dueMonth: null,
  startDate: "2026-01-01",
  endDate: null,
}

async function insertRent(): Promise<string> {
  const [row] = await db
    .insert(fixedItems)
    .values({ ...rentPayload, periodicity: "monthly", categoryId: housing })
    .returning({ id: fixedItems.id })
  if (!row) throw new Error("Poste fixe de test impossible à créer")
  return row.id
}

async function storedByLabel() {
  const rows = await db.select().from(transactions)
  return new Map(rows.map((row) => [row.rawLabel, row]))
}

beforeEach(async () => {
  db = await createTestDb()
  accountId = await createTestAccount(db)
  const [category] = await db.insert(categories).values({ name: "Logement", color: "#4a84c4" }).returning()
  if (!category) throw new Error("Catégorie de test impossible à créer")
  housing = category.id
})

describe("fixed item routes", () => {
  it("creates an item with a rule that links existing transactions", async () => {
    const leisure = await db.insert(categories).values({ name: "Loisirs", color: "#5b9a4f" }).returning()
    await insertTestTransactions(db, accountId, [
      { rawLabel: "Ordre permanent Régie Fictive", bookingDate: "2026-02-25", amount: -1500 },
      { rawLabel: "Ordre permanent REGIE FICTIVE mars", categoryId: leisure[0]?.id ?? null, amount: -1500 },
      { rawLabel: "Achat Kiosque" },
    ])

    const response = await routes().request(
      "/",
      json("POST", {
        ...rentPayload,
        categoryId: housing,
        rule: { pattern: "régie fictive", matchKind: "contains", field: "raw_label" },
      }),
    )
    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body).toMatchObject({ name: "Loyer fictif", linkedCount: 2, monthlyEquivalent: -1500 })
    const created = z.object({ id: z.string() }).parse(body)

    const [rule] = await db.select().from(rules).where(eq(rules.fixedItemId, created.id))
    expect(rule).toMatchObject({ categoryId: housing, priority: 60, pattern: "régie fictive" })

    const stored = await storedByLabel()
    expect(stored.get("Ordre permanent Régie Fictive")).toMatchObject({ fixedItemId: created.id, categoryId: housing })
    expect(stored.get("Ordre permanent REGIE FICTIVE mars")).toMatchObject({
      fixedItemId: created.id,
      categoryId: leisure[0]?.id,
    })
    expect(stored.get("Achat Kiosque")?.fixedItemId).toBeNull()
  })

  it("matches transactions to occurrences in the overview", async () => {
    const rent = await insertRent()
    await insertTestTransactions(db, accountId, [
      { rawLabel: "Loyer février", bookingDate: "2026-02-24", amount: -1500, fixedItemId: rent },
      { rawLabel: "Loyer hors fenêtre", bookingDate: "2026-03-12", amount: -1450, fixedItemId: rent },
    ])

    const response = await routes().request("/overview?from=2026-02-01&to=2026-03-31")
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      items: [
        {
          fixedItemId: rent,
          occurrences: [
            { dueDate: "2026-02-25", status: "paid", actualAmount: -1500, deviation: 0 },
            { dueDate: "2026-03-25", status: "paid", actualAmount: -1450, deviation: 50 },
          ],
          nextOccurrence: { dueDate: "2026-04-25", status: "upcoming" },
        },
      ],
      totals: {
        monthlyEquivalent: { expenses: -1500, incomes: 0 },
        overdueCount: 0,
        upcomingWithin30Days: { count: 1, amount: -1500 },
      },
    })
  })

  it("reports an unpaid past occurrence as overdue", async () => {
    await insertRent()
    const response = await routes().request("/overview?from=2026-02-01&to=2026-02-28")
    expect(await response.json()).toMatchObject({
      items: [{ occurrences: [{ dueDate: "2026-02-25", status: "overdue" }] }],
      totals: { overdueCount: 1 },
    })
  })

  it("soft deletes an item, detaches transactions and removes its rule", async () => {
    const rent = await insertRent()
    await db.insert(rules).values({ pattern: "loyer", matchKind: "contains", field: "raw_label", fixedItemId: rent })
    await insertTestTransactions(db, accountId, [{ rawLabel: "Loyer", fixedItemId: rent }])

    const response = await routes().request(`/${rent}`, { method: "DELETE" })
    expect(response.status).toBe(200)

    const [item] = await db.select().from(fixedItems).where(eq(fixedItems.id, rent))
    expect(item?.deletedAt).not.toBeNull()
    const [rule] = await db.select().from(rules)
    expect(rule?.deletedAt).not.toBeNull()
    expect((await storedByLabel()).get("Loyer")?.fixedItemId).toBeNull()
    expect(await (await routes().request("/")).json()).toEqual([])
  })

  it("removes the linked rule when the update sends rule null", async () => {
    const rent = await insertRent()
    await db.insert(rules).values({ pattern: "loyer", matchKind: "contains", field: "raw_label", fixedItemId: rent })
    const response = await routes().request(`/${rent}`, json("PUT", { ...rentPayload, categoryId: null, rule: null }))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ rule: null, categoryId: null })
  })

  it("makes the linked rule follow the item category", async () => {
    const rent = await insertRent()
    await db.insert(rules).values({ pattern: "loyer", matchKind: "contains", field: "raw_label", fixedItemId: rent })
    await routes().request(`/${rent}`, json("PUT", { ...rentPayload, categoryId: null }))
    const [rule] = await db.select().from(rules)
    expect(rule).toMatchObject({ categoryId: null, deletedAt: null })
  })
})
