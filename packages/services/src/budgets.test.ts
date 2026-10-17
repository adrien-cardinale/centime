import { type BudgetPayload, budgetPayloadSchema } from "@centime/core"
import { categories, type Db } from "@centime/db"
import { beforeEach, describe, expect, it } from "bun:test"
import { budgetsOverview, createBudget } from "./budgets"
import { ServiceError } from "./errors"
import { createTestAccount, createTestDb } from "./test-support/database"
import { createTransaction } from "./transaction-create"

const DATE = "2026-03-15"

let db: Db
let accountId: string
let salary: string

async function insertCategory(name: string): Promise<string> {
  const [category] = await db.insert(categories).values({ name, color: "#4a84c4" }).returning()
  if (!category) throw new Error("Catégorie de test impossible à créer")
  return category.id
}

function payload(input: Record<string, unknown>): BudgetPayload {
  return budgetPayloadSchema.parse({ period: "monthly", rollover: false, startDate: "2026-01-01", ...input })
}

async function insertTransaction(categoryId: string | null, amount: number, bookingDate = "2026-03-02") {
  await createTransaction(db, {
    accountId,
    bookingDate,
    rawLabel: "Mouvement",
    merchant: null,
    amount,
    status: "booked",
    categoryId,
    isTransfer: false,
  })
}

beforeEach(async () => {
  db = await createTestDb()
  accountId = await createTestAccount(db)
  salary = await insertCategory("Salaire")
})

describe("income budgets", () => {
  it("compare the expected amount with what the category received in the period", async () => {
    await createBudget(db, payload({ kind: "income", categoryId: salary, amount: 5000 }))
    await insertTransaction(salary, 4800)
    await insertTransaction(salary, 4900, "2026-02-25")

    const overview = await budgetsOverview(db, DATE, DATE)

    expect(overview.incomes[0]?.status).toMatchObject({ expected: 5000, received: 4800, remaining: 200 })
    expect(overview.income).toEqual({ expected: 5000, actual: 4800 })
  })

  it("stay out of the envelopes and of the unbudgeted spending", async () => {
    await createBudget(db, payload({ kind: "income", categoryId: salary, amount: 5000 }))
    await insertTransaction(salary, -50)

    const overview = await budgetsOverview(db, DATE, DATE)

    expect(overview.budgets).toEqual([])
    expect(overview.unbudgeted).toEqual([])
  })

  it("share the one-budget-per-category rule with envelopes", async () => {
    await createBudget(db, payload({ kind: "income", categoryId: salary, amount: 5000 }))

    const creation = createBudget(db, payload({ kind: "envelope", categoryId: salary, amount: 200 }))

    await expect(creation).rejects.toBeInstanceOf(ServiceError)
  })
})
