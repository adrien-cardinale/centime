import { periodContaining } from "@centime/core"
import { categories, type Db, transactionSplits } from "@centime/db"
import { beforeEach, describe, expect, it } from "bun:test"
import { budgetsOverview, createBudget } from "./budgets"
import { deleteCategory, listCategories } from "./categories"
import { categoryBreakdown } from "./dashboard"
import { ServiceError } from "./errors"
import { applyRules, createRule } from "./rules"
import { createTestAccount, createTestDb } from "./test-support/database"
import { createTransaction } from "./transaction-create"
import { exportTransactionsCsv } from "./transaction-export"
import { splitTransaction, unsplitTransaction } from "./transaction-splits"
import { bulkUpdateTransactions, updateTransaction } from "./transaction-updates"
import { listTransactionPage } from "./transactions"

const BOOKING_DATE = "2026-03-04"
const MISSING_ID = "8f0b6c1e-2d4a-4b7e-9a3c-5e6f7a8b9c0d"

let db: Db
let accountId: string
let groceries: string
let household: string

async function insertCategory(name: string): Promise<string> {
  const [category] = await db.insert(categories).values({ name, color: "#4a84c4" }).returning()
  if (!category) throw new Error("Catégorie de test impossible à créer")
  return category.id
}

async function insertTransaction(amount = -100, rawLabel = "Supermarché"): Promise<string> {
  const created = await createTransaction(db, {
    accountId,
    bookingDate: BOOKING_DATE,
    rawLabel,
    merchant: null,
    amount,
    status: "booked",
    categoryId: null,
    fixedItemId: null,
    isTransfer: false,
  })
  return created.id
}

function splitInHalf(transactionId: string, first = -60, second = -40) {
  return splitTransaction(db, {
    transactionId,
    splits: [
      { categoryId: groceries, amount: first, note: null },
      { categoryId: household, amount: second, note: "Lessive" },
    ],
  })
}

async function activeSplits(transactionId: string) {
  const rows = await db.select().from(transactionSplits)
  return rows
    .filter((row) => row.transactionId === transactionId && row.deletedAt === null)
    .sort((left, right) => left.position - right.position)
}

async function listedItem(transactionId: string) {
  const page = await listTransactionPage(db, { page: 1, pageSize: 50 })
  return page.items.find((item) => item.id === transactionId)
}

beforeEach(async () => {
  db = await createTestDb()
  accountId = await createTestAccount(db)
  groceries = await insertCategory("Courses")
  household = await insertCategory("Ménage")
})

describe("splitTransaction", () => {
  it("stores the lines in order and clears the transaction category", async () => {
    const transactionId = await insertTransaction()
    await updateTransaction(db, { id: transactionId, categoryId: groceries, isTransfer: false })

    const split = await splitInHalf(transactionId)

    expect(split).toMatchObject({ isSplit: true, categoryId: null, fixedItemId: null, isTransfer: false })
    expect(split.splits.map((line) => [line.categoryId, line.amount, line.note])).toEqual([
      [groceries, -60, null],
      [household, -40, "Lessive"],
    ])
  })

  it("refuses lines that do not add up to the amount", async () => {
    const transactionId = await insertTransaction()
    const split = splitInHalf(transactionId, -60, -39.99)
    await expect(split).rejects.toMatchObject({ status: 400 })
    expect(await activeSplits(transactionId)).toHaveLength(0)
  })

  it("compares the sum in cents", async () => {
    const transactionId = await insertTransaction(-0.3)
    const split = await splitInHalf(transactionId, -0.1, -0.2)
    expect(split.splits).toHaveLength(2)
  })

  it("returns 404 for an unknown transaction", async () => {
    await expect(splitInHalf(MISSING_ID)).rejects.toMatchObject({ status: 404 })
  })

  it("rejects an unknown category", async () => {
    const transactionId = await insertTransaction()
    const split = splitTransaction(db, {
      transactionId,
      splits: [
        { categoryId: MISSING_ID, amount: -50, note: null },
        { categoryId: null, amount: -50, note: null },
      ],
    })
    await expect(split).rejects.toBeInstanceOf(ServiceError)
  })

  it("replaces the previous lines when split again", async () => {
    const transactionId = await insertTransaction()
    await splitInHalf(transactionId)

    await splitInHalf(transactionId, -70, -30)

    expect((await activeSplits(transactionId)).map((row) => row.amount)).toEqual([-70, -30])
  })
})

describe("unsplitTransaction", () => {
  it("removes the lines and leaves the transaction uncategorized", async () => {
    const transactionId = await insertTransaction()
    await splitInHalf(transactionId)

    const unsplit = await unsplitTransaction(db, { transactionId })

    expect(unsplit).toMatchObject({ isSplit: false, categoryId: null, splits: [] })
    expect(await activeSplits(transactionId)).toHaveLength(0)
  })

  it("returns 404 for an unknown transaction", async () => {
    await expect(unsplitTransaction(db, { transactionId: MISSING_ID })).rejects.toMatchObject({ status: 404 })
  })
})

describe("transaction updates", () => {
  it("unsplits a transaction when its category changes", async () => {
    const transactionId = await insertTransaction()
    await splitInHalf(transactionId)

    await updateTransaction(db, { id: transactionId, categoryId: household })

    expect(await listedItem(transactionId)).toMatchObject({ isSplit: false, categoryId: household, splits: [] })
    expect(await activeSplits(transactionId)).toHaveLength(0)
  })

  it("unsplits the selected transactions marked as transfers in bulk", async () => {
    const transactionId = await insertTransaction()
    await splitInHalf(transactionId)

    await bulkUpdateTransactions(db, { ids: [transactionId], isTransfer: true })

    expect(await listedItem(transactionId)).toMatchObject({ isSplit: false, isTransfer: true })
    expect(await activeSplits(transactionId)).toHaveLength(0)
  })
})

describe("listing", () => {
  it("returns the lines of a split transaction with their category", async () => {
    const transactionId = await insertTransaction()
    await splitInHalf(transactionId)

    const item = await listedItem(transactionId)

    expect(item?.isSplit).toBe(true)
    expect(item?.splits.map((line) => [line.categoryName, line.amount])).toEqual([
      ["Courses", -60],
      ["Ménage", -40],
    ])
  })

  it("filters by the category of a line", async () => {
    const splitId = await insertTransaction()
    const otherId = await insertTransaction(-20, "Pharmacie")
    await splitInHalf(splitId)

    const byHousehold = await listTransactionPage(db, { page: 1, pageSize: 50, categoryId: household })
    const uncategorized = await listTransactionPage(db, { page: 1, pageSize: 50, categoryId: "none" })

    expect(byHousehold.items.map((item) => item.id)).toEqual([splitId])
    expect(uncategorized.items.map((item) => item.id)).toEqual([otherId])
  })

  it("counts a split transaction once per category", async () => {
    const transactionId = await insertTransaction()
    await splitTransaction(db, {
      transactionId,
      splits: [
        { categoryId: groceries, amount: -50, note: null },
        { categoryId: groceries, amount: -30, note: null },
        { categoryId: household, amount: -20, note: null },
      ],
    })

    const counts = Object.fromEntries((await listCategories(db)).map((row) => [row.name, row.transactionCount]))

    expect(counts).toEqual({ Courses: 1, Ménage: 1 })
  })

  it("exports one row per line", async () => {
    const transactionId = await insertTransaction()
    await splitInHalf(transactionId)

    const csv = await exportTransactionsCsv(db, undefined)

    const rows = csv.trim().split("\r\n").slice(1)
    expect(rows).toHaveLength(2)
    expect(rows[1]).toContain("-40.00")
    expect(rows[1]).toContain("Ménage")
    expect(rows[1]).toContain("Lessive")
  })
})

describe("aggregations", () => {
  it("spreads the dashboard spending over the categories of the lines", async () => {
    await splitInHalf(await insertTransaction())

    const breakdown = await categoryBreakdown(db, periodContaining("monthly", BOOKING_DATE))

    const spentByCategory = Object.fromEntries(breakdown.map((entry) => [entry.categoryId, entry.amount]))
    expect(spentByCategory).toEqual({ [groceries]: 60, [household]: 40 })
  })

  it("counts the lines in the budget of their category", async () => {
    await createBudget(db, {
      categoryId: household,
      amount: 100,
      period: "monthly",
      rollover: false,
      startDate: "2026-01-01",
    })
    await splitInHalf(await insertTransaction())

    const overview = await budgetsOverview(db, BOOKING_DATE, BOOKING_DATE)

    expect(overview.budgets[0]?.status.spent).toBe(40)
    expect(overview.unbudgeted.map((entry) => [entry.categoryId, entry.spent])).toEqual([[groceries, 60]])
  })

  it("ignores the lines once the category is deleted", async () => {
    const transactionId = await insertTransaction()
    await splitInHalf(transactionId)

    await deleteCategory(db, { id: household })

    const item = await listedItem(transactionId)
    expect(item?.splits.map((line) => line.categoryId)).toEqual([groceries, null])
  })
})

describe("rules", () => {
  it("leave split transactions untouched", async () => {
    const transactionId = await insertTransaction()
    await splitInHalf(transactionId)
    await createRule(db, {
      pattern: "Supermarché",
      matchKind: "contains",
      field: "raw_label",
      categoryId: groceries,
      markAsTransfer: false,
      priority: 0,
    })

    await applyRules(db, { scope: "all" })

    expect(await listedItem(transactionId)).toMatchObject({ isSplit: true, categoryId: null })
    expect(await activeSplits(transactionId)).toHaveLength(2)
  })
})
