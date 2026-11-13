import { accounts, type Db, transactions } from "@centime/db"
import { beforeEach, describe, expect, it } from "bun:test"
import { eq } from "drizzle-orm"
import { loadBaseCurrencyContext, saveBaseCurrency } from "./base-currency"
import { dashboardOverview } from "./dashboard"
import { ServiceError } from "./errors"
import { createTestDb } from "./test-support/database"
import { createTransaction } from "./transaction-create"

const DATE = "2026-03-15"

let db: Db

async function insertAccount(identifier: string, currency: string): Promise<string> {
  const [account] = await db
    .insert(accounts)
    .values({ name: identifier, kind: "bank", identifier, currency })
    .returning({ id: accounts.id })
  if (!account) throw new Error("Compte de test impossible à créer")
  return account.id
}

async function insertTransaction(accountId: string, amount: number, balanceAfter: number) {
  const created = await createTransaction(db, {
    accountId,
    bookingDate: "2026-03-02",
    rawLabel: "Mouvement",
    merchant: null,
    amount,
    status: "booked",
    categoryId: null,
    isTransfer: false,
  })
  await db.update(transactions).set({ balanceAfter }).where(eq(transactions.id, created.id))
}

beforeEach(async () => {
  db = await createTestDb()
})

describe("loadBaseCurrencyContext", () => {
  it("defaults to CHF without accounts", async () => {
    expect(await loadBaseCurrencyContext(db)).toEqual({ currency: "CHF", otherCurrencyAccounts: 0, options: ["CHF"] })
  })

  it("defaults to the currency of most accounts", async () => {
    await insertAccount("A", "EUR")
    await insertAccount("B", "EUR")
    await insertAccount("C", "CHF")

    expect(await loadBaseCurrencyContext(db)).toEqual({
      currency: "EUR",
      otherCurrencyAccounts: 1,
      options: ["CHF", "EUR"],
    })
  })

  it("uses the saved preference", async () => {
    await insertAccount("A", "EUR")
    await saveBaseCurrency(db, "chf")

    expect(await loadBaseCurrencyContext(db)).toMatchObject({ currency: "CHF", otherCurrencyAccounts: 1 })
  })

  it("rejects an invalid currency", async () => {
    await expect(saveBaseCurrency(db, "EUROS")).rejects.toBeInstanceOf(ServiceError)
  })
})

describe("dashboard totals", () => {
  it("leave out the accounts held in another currency", async () => {
    const chf = await insertAccount("CHF-1", "CHF")
    const eur = await insertAccount("EUR-1", "EUR")
    await insertTransaction(chf, -40, 960)
    await insertTransaction(eur, -1000, 5000)
    await saveBaseCurrency(db, "CHF")

    const overview = await dashboardOverview(db, DATE, DATE)

    expect(overview.currency).toBe("CHF")
    expect(overview.otherCurrencyAccounts).toBe(1)
    expect(overview.kpis.expenses.current).toBe(40)
    expect(overview.kpis.bankBalance).toBe(960)
  })
})
