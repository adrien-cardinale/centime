import { categories, type Db, rules, transactions } from "@centime/db"
import { beforeEach, describe, expect, it } from "vitest"
import { createTestAccount, createTestDb, insertTestTransactions } from "../test-support/database"
import { createRuleRoutes } from "./rules"

let db: Db
let accountId: string
let food: string
let leisure: string

function post(body: unknown): RequestInit {
  return { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
}

async function insertCategory(name: string): Promise<string> {
  const [row] = await db.insert(categories).values({ name, color: "#5b9a4f" }).returning({ id: categories.id })
  if (!row) throw new Error("Catégorie de test impossible à créer")
  return row.id
}

async function storedByLabel() {
  const rows = await db.select().from(transactions)
  return new Map(rows.map((row) => [row.rawLabel, row]))
}

beforeEach(async () => {
  db = await createTestDb()
  accountId = await createTestAccount(db)
  food = await insertCategory("Alimentation")
  leisure = await insertCategory("Loisirs")
  await db.insert(rules).values([
    { pattern: "épicerie", matchKind: "contains", field: "raw_label", categoryId: food, priority: 5 },
    { pattern: "cpt. epargne", matchKind: "contains", field: "raw_label", markAsTransfer: true, priority: 100 },
  ])
  await insertTestTransactions(db, accountId, [
    { rawLabel: "Achat EPICERIE FICTIVE" },
    { rawLabel: "Achat Epicerie du coin", categoryId: leisure },
    { rawLabel: "Transfert sur Cpt. épargne" },
    { rawLabel: "Achat Cinéma Fictif", categoryId: leisure },
    { rawLabel: "Achat Kiosque" },
  ])
})

describe("rule routes", () => {
  it("applies rules to uncategorized transactions only", async () => {
    const response = await createRuleRoutes(db).request("/apply", post({ scope: "uncategorized" }))
    expect(await response.json()).toEqual({ examined: 3, categorized: 1, markedAsTransfer: 1, linkedToFixedItem: 0 })
    const stored = await storedByLabel()
    expect(stored.get("Achat EPICERIE FICTIVE")?.categoryId).toBe(food)
    expect(stored.get("Achat Epicerie du coin")?.categoryId).toBe(leisure)
    expect(stored.get("Transfert sur Cpt. épargne")?.isTransfer).toBe(true)
    expect(stored.get("Achat Kiosque")?.categoryId).toBeNull()
  })

  it("recomputes every transaction but keeps manual categories without a match", async () => {
    const response = await createRuleRoutes(db).request("/apply", post({ scope: "all" }))
    expect(await response.json()).toEqual({ examined: 5, categorized: 2, markedAsTransfer: 1, linkedToFixedItem: 0 })
    const stored = await storedByLabel()
    expect(stored.get("Achat Epicerie du coin")?.categoryId).toBe(food)
    expect(stored.get("Achat Cinéma Fictif")?.categoryId).toBe(leisure)
  })

  it("tests a pattern against stored transactions", async () => {
    const response = await createRuleRoutes(db).request(
      "/test",
      post({ pattern: "EPICERIE", matchKind: "contains", field: "raw_label" }),
    )
    const body = await response.json()
    expect(body).toMatchObject({ count: 2 })
  })

  it("rejects an invalid regex with a clear message", async () => {
    const response = await createRuleRoutes(db).request(
      "/",
      post({ pattern: "(", matchKind: "regex", field: "raw_label", categoryId: food, markAsTransfer: false, priority: 0 }),
    )
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: expect.stringContaining("Expression régulière invalide") })
  })

  it("rejects a rule without target", async () => {
    const response = await createRuleRoutes(db).request(
      "/",
      post({ pattern: "x", matchKind: "contains", field: "raw_label", categoryId: null, markAsTransfer: false, priority: 0 }),
    )
    expect(response.status).toBe(400)
  })
})
