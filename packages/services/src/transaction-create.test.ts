import { categories, type Db, fixedItems } from "@centime/db"
import { beforeEach, describe, expect, it } from "bun:test"
import { ServiceError } from "./errors"
import { createTestAccount, createTestDb } from "./test-support/database"
import { createTransaction } from "./transaction-create"
import { listTransactionPage } from "./transactions"

const INPUT = {
  bookingDate: "2026-03-04",
  rawLabel: "Boulangerie",
  merchant: null,
  amount: -12.5,
  status: "booked",
  categoryId: null,
  fixedItemId: null,
  isTransfer: false,
} as const

let db: Db
let accountId: string

beforeEach(async () => {
  db = await createTestDb()
  accountId = await createTestAccount(db)
})

describe("createTransaction", () => {
  it("takes the currency from the account and shows up in the list", async () => {
    const created = await createTransaction(db, { ...INPUT, accountId })
    expect(created.currency).toBe("CHF")
    const page = await listTransactionPage(db, { page: 1, pageSize: 10 })
    expect(page.items.map((item) => item.id)).toEqual([created.id])
  })

  it("accepts two identical transactions on the same day", async () => {
    const first = await createTransaction(db, { ...INPUT, accountId })
    const second = await createTransaction(db, { ...INPUT, accountId })
    expect(second.fingerprint).not.toBe(first.fingerprint)
  })

  it("inherits the category of the linked fixed item", async () => {
    const [category] = await db.insert(categories).values({ name: "Courses", color: "#4a84c4" }).returning()
    const [fixedItem] = await db
      .insert(fixedItems)
      .values({
        name: "Abonnement",
        expectedAmount: -12.5,
        periodicity: "monthly",
        categoryId: category?.id ?? null,
        startDate: "2026-01-01",
      })
      .returning()
    const created = await createTransaction(db, { ...INPUT, accountId, fixedItemId: fixedItem?.id ?? null })
    expect(created.categoryId).toBe(category?.id ?? null)
  })

  it("rejects an unknown account", async () => {
    const creation = createTransaction(db, { ...INPUT, accountId: "missing" })
    await expect(creation).rejects.toBeInstanceOf(ServiceError)
  })
})
