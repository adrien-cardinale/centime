import { type BudgetPayload, budgetPayloadSchema } from "@centime/core"
import { accounts, categories, type Db } from "@centime/db"
import { beforeEach, describe, expect, it } from "bun:test"
import { budgetsOverview, createBudget, findBudget, updateBudget } from "./budgets"
import { ServiceError } from "./errors"
import { createRule, listRules } from "./rules"
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

const TRANSACTION = {
  bookingDate: "2026-03-02",
  rawLabel: "Mouvement",
  merchant: null,
  status: "booked",
  isTransfer: false,
} as const

async function insertTransaction(categoryId: string | null, amount: number, bookingDate = "2026-03-02") {
  await createTransaction(db, { ...TRANSACTION, accountId, bookingDate, amount, categoryId })
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

describe("budget rules", () => {
  const matcher = { pattern: "Salaire SA", matchKind: "contains", field: "raw_label" } as const

  it("leave the existing rules of the category alone when created without a rule", async () => {
    const userRule = await createRule(db, { ...matcher, categoryId: salary, markAsTransfer: false, priority: 0 })

    const budget = await createBudget(db, payload({ kind: "income", categoryId: salary, amount: 5000, rule: null }))

    expect(budget.rule).toBeNull()
    expect((await listRules(db)).map((rule) => rule.id)).toEqual([userRule.id])
  })

  it("own the rule they create and remove only that one", async () => {
    const userRule = await createRule(db, { ...matcher, categoryId: salary, markAsTransfer: false, priority: 0 })
    const budget = await createBudget(
      db,
      payload({ kind: "income", categoryId: salary, amount: 5000, rule: { ...matcher, pattern: "Bonus" } }),
    )
    expect(budget.rule).toMatchObject({ pattern: "Bonus" })

    await updateBudget(db, {
      id: budget.id,
      ...payload({ kind: "income", categoryId: salary, amount: 5000, rule: null }),
    })

    expect((await listRules(db)).map((rule) => rule.id)).toEqual([userRule.id])
  })

  it("never move a rule they do not own to another category", async () => {
    const other = await insertCategory("Prime")
    const userRule = await createRule(db, { ...matcher, categoryId: salary, markAsTransfer: false, priority: 0 })
    const budget = await createBudget(db, payload({ kind: "income", categoryId: salary, amount: 5000 }))

    await updateBudget(db, {
      id: budget.id,
      ...payload({ kind: "income", categoryId: other, amount: 5000, rule: { ...matcher, pattern: "Prime" } }),
    })

    const rules = await listRules(db)
    expect(rules.find((rule) => rule.id === userRule.id)).toMatchObject({ categoryId: salary, budgetId: null })
    expect(rules.find((rule) => rule.id !== userRule.id)).toMatchObject({ categoryId: other, budgetId: budget.id })
    expect((await findBudget(db, budget.id))?.rule).toMatchObject({ pattern: "Prime" })
  })
})

describe("base currency", () => {
  it("leave out the transactions of accounts in another currency", async () => {
    const groceries = await insertCategory("Courses")
    await createBudget(db, payload({ kind: "envelope", categoryId: groceries, amount: 400 }))
    await insertTransaction(groceries, -100)
    const [euroAccount] = await db
      .insert(accounts)
      .values({ name: "Euro", kind: "bank", identifier: "DE0000000000000000000", currency: "EUR" })
      .returning({ id: accounts.id })
    if (!euroAccount) throw new Error("Compte de test impossible à créer")
    await createTransaction(db, { ...TRANSACTION, accountId: euroAccount.id, categoryId: groceries, amount: -900 })

    const overview = await budgetsOverview(db, DATE, DATE)

    expect(overview.currency).toBe("CHF")
    expect(overview.budgets[0]?.status.spent).toBe(100)
    expect(overview.envelopes.actual).toBe(100)
  })
})
