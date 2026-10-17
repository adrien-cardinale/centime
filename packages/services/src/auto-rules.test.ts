import { categories, type Db } from "@centime/db"
import { beforeEach, describe, expect, it } from "bun:test"
import { createRulesFromRepeatedCategorization } from "./auto-rules"
import { createRule, listRules } from "./rules"
import { createTestAccount, createTestDb } from "./test-support/database"
import { createTransaction } from "./transaction-create"

const LABEL = "Coop Pronto"

let db: Db
let accountId: string
let groceries: string
let leisure: string

async function insertCategory(name: string): Promise<string> {
  const [category] = await db.insert(categories).values({ name, color: "#4a84c4" }).returning()
  if (!category) throw new Error("Catégorie de test impossible à créer")
  return category.id
}

async function insertTransaction(categoryId: string | null, rawLabel = LABEL): Promise<string> {
  const created = await createTransaction(db, {
    accountId,
    bookingDate: "2026-03-04",
    rawLabel,
    merchant: null,
    amount: -12,
    status: "booked",
    categoryId,
    isTransfer: false,
  })
  return created.id
}

async function insertMany(count: number, categoryId: string | null): Promise<string[]> {
  const ids: string[] = []
  for (let index = 0; index < count; index++) ids.push(await insertTransaction(categoryId))
  return ids
}

beforeEach(async () => {
  db = await createTestDb()
  accountId = await createTestAccount(db)
  groceries = await insertCategory("Courses")
  leisure = await insertCategory("Loisirs")
})

describe("createRulesFromRepeatedCategorization", () => {
  it("creates a rule once the third similar transaction is categorized", async () => {
    const ids = await insertMany(3, groceries)

    const { created } = await createRulesFromRepeatedCategorization(db, { ids: ids.slice(2) })

    expect(created).toHaveLength(1)
    expect(created[0]).toMatchObject({
      pattern: LABEL,
      field: "raw_label",
      matchKind: "contains",
      categoryId: groceries,
      markAsTransfer: false,
      priority: 0,
    })
  })

  it("waits for the threshold", async () => {
    const ids = await insertMany(2, groceries)

    const { created } = await createRulesFromRepeatedCategorization(db, { ids })

    expect(created).toHaveLength(0)
    expect(await listRules(db)).toHaveLength(0)
  })

  it("skips a transaction already covered by a rule", async () => {
    await createRule(db, {
      pattern: "coop",
      matchKind: "contains",
      field: "raw_label",
      categoryId: groceries,
      markAsTransfer: false,
      priority: 0,
    })
    const ids = await insertMany(3, groceries)

    const { created } = await createRulesFromRepeatedCategorization(db, { ids })

    expect(created).toHaveLength(0)
    expect(await listRules(db)).toHaveLength(1)
  })

  it("skips a pattern whose matches disagree on the category", async () => {
    const ids = await insertMany(3, groceries)
    await insertTransaction(leisure)

    const { created } = await createRulesFromRepeatedCategorization(db, { ids })

    expect(created).toHaveLength(0)
  })

  it("ignores uncategorized matches", async () => {
    const ids = await insertMany(3, groceries)
    await insertTransaction(null)

    const { created } = await createRulesFromRepeatedCategorization(db, { ids })

    expect(created).toHaveLength(1)
  })

  it("creates a single rule for a bulk categorization", async () => {
    const ids = await insertMany(4, groceries)

    const { created } = await createRulesFromRepeatedCategorization(db, { ids })

    expect(created).toHaveLength(1)
    expect(await listRules(db)).toHaveLength(1)
  })
})
