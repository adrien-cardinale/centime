import { accounts, categories, type Db, transactions } from "@centime/db"
import { beforeEach, describe, expect, it } from "vitest"
import type { DashboardOverview } from "../services/dashboard"
import { createTestAccount, createTestDb, insertTestTransactions, readJson } from "../test-support/database"
import { createDashboardRoutes } from "./dashboard"

let db: Db
let accountId: string

const TODAY = new Date(2026, 8, 20)

async function overview(date = "2026-09-15"): Promise<DashboardOverview> {
  const response = await createDashboardRoutes(db, () => TODAY).request(`/?date=${date}`)
  expect(response.status).toBe(200)
  return readJson<DashboardOverview>(response)
}

async function insertCategory(name: string, parentId: string | null = null): Promise<string> {
  const [row] = await db.insert(categories).values({ name, color: "#4a84c4", parentId }).returning({ id: categories.id })
  if (!row) throw new Error("Catégorie de test impossible à créer")
  return row.id
}

async function insertAccount(kind: "bank" | "card", identifier: string): Promise<string> {
  const [row] = await db
    .insert(accounts)
    .values({ name: `Compte ${identifier}`, kind, identifier })
    .returning({ id: accounts.id })
  if (!row) throw new Error("Compte de test impossible à créer")
  return row.id
}

type BalanceRow = { accountId: string; bookingDate: string; balanceAfter: number; createdAt?: string }

async function insertBalances(rows: BalanceRow[]): Promise<void> {
  await db.insert(transactions).values(
    rows.map((row, index) => ({
      accountId: row.accountId,
      bookingDate: row.bookingDate,
      rawLabel: `Opération ${index}`,
      amount: -1,
      currency: "CHF",
      status: "booked" as const,
      fingerprint: `balance-${index}`,
      balanceAfter: row.balanceAfter,
      createdAt: row.createdAt ?? "2026-09-01T00:00:00.000Z",
    })),
  )
}

beforeEach(async () => {
  db = await createTestDb()
  accountId = await createTestAccount(db)
})

describe("dashboard route", () => {
  it("computes the month KPIs without transfers nor pending transactions", async () => {
    await insertTestTransactions(db, accountId, [
      { rawLabel: "Salaire", bookingDate: "2026-09-25", amount: 5000 },
      { rawLabel: "Courses", bookingDate: "2026-09-03", amount: -120.5 },
      { rawLabel: "Loyer", bookingDate: "2026-09-01", amount: -1500 },
      { rawLabel: "Virement épargne", bookingDate: "2026-09-10", amount: -1000, isTransfer: true },
      { rawLabel: "Achat en attente", bookingDate: "2026-09-18", amount: -80, status: "pending" },
      { rawLabel: "Salaire août", bookingDate: "2026-08-25", amount: 4800 },
      { rawLabel: "Courses août", bookingDate: "2026-08-12", amount: -300 },
    ])

    const { kpis } = await overview()

    expect(kpis.income).toEqual({ current: 5000, previous: 4800 })
    expect(kpis.expenses).toEqual({ current: 1620.5, previous: 300 })
    expect(kpis.net).toEqual({ current: 3379.5, previous: 4500 })
    expect(kpis.pendingCount).toBe(1)
    expect(kpis.uncategorizedCount).toBe(6)
    expect(kpis.bankBalance).toBeNull()
  })

  it("returns twelve months ending with the reference month, empty months at zero", async () => {
    await insertTestTransactions(db, accountId, [
      { rawLabel: "Trop ancien", bookingDate: "2025-09-30", amount: -999 },
      { rawLabel: "Octobre", bookingDate: "2025-10-05", amount: -40 },
      { rawLabel: "Janvier", bookingDate: "2026-01-15", amount: 200 },
      { rawLabel: "Futur", bookingDate: "2026-10-01", amount: -999 },
    ])

    const { monthlySeries } = await overview()

    expect(monthlySeries).toHaveLength(12)
    expect(monthlySeries[0]).toEqual({ month: "2025-10-01", label: "Octobre 2025", income: 0, expenses: 40 })
    expect(monthlySeries[3]).toMatchObject({ month: "2026-01-01", income: 200, expenses: 0 })
    expect(monthlySeries[11]).toMatchObject({ month: "2026-09-01", income: 0, expenses: 0 })
  })

  it("groups spending by top-level category with Autres and Non catégorisées", async () => {
    const parent = await insertCategory("Alimentation")
    const child = await insertCategory("Supermarché", parent)
    const others = await Promise.all(Array.from({ length: 8 }, (_, index) => insertCategory(`Catégorie ${index}`)))
    await insertTestTransactions(db, accountId, [
      { rawLabel: "Parent", categoryId: parent, bookingDate: "2026-09-02", amount: -100 },
      { rawLabel: "Enfant", categoryId: child, bookingDate: "2026-09-03", amount: -400 },
      { rawLabel: "Remboursement", categoryId: parent, bookingDate: "2026-09-04", amount: 50 },
      { rawLabel: "Sans catégorie", bookingDate: "2026-09-05", amount: -300 },
      ...others.map((categoryId, index) => ({
        rawLabel: `Dépense ${index}`,
        categoryId,
        bookingDate: "2026-09-06",
        amount: -(index + 1) * 10,
      })),
    ])

    const { categoryBreakdown } = await overview()

    expect(categoryBreakdown).toHaveLength(8)
    expect(categoryBreakdown[0]).toMatchObject({ categoryId: parent, name: "Alimentation", amount: 500, kind: "category" })
    expect(categoryBreakdown[1]).toMatchObject({ categoryId: null, name: "Non catégorisées", amount: 300, kind: "uncategorized" })
    expect(categoryBreakdown.slice(2, 7).map((entry) => entry.amount)).toEqual([80, 70, 60, 50, 40])
    expect(categoryBreakdown[7]).toEqual({ categoryId: null, name: "Autres", color: null, amount: 60, kind: "other" })
  })

  it("sums the latest balance of every bank account, month by month", async () => {
    const secondBank = await insertAccount("bank", "CH1111111111111111111")
    const card = await insertAccount("card", "CARTE-TEST")
    await insertBalances([
      { accountId, bookingDate: "2026-07-10", balanceAfter: 1000 },
      { accountId, bookingDate: "2026-08-20", balanceAfter: 1500, createdAt: "2026-09-01T00:00:00.000Z" },
      { accountId, bookingDate: "2026-08-20", balanceAfter: 1400, createdAt: "2026-09-02T00:00:00.000Z" },
      { accountId: secondBank, bookingDate: "2026-08-05", balanceAfter: 300 },
      { accountId: secondBank, bookingDate: "2026-09-10", balanceAfter: 250 },
      { accountId: card, bookingDate: "2026-09-12", balanceAfter: -700 },
    ])

    const result = await overview()

    expect(result.kpis.bankBalance).toBe(1650)
    expect(result.balanceSeries).toEqual([
      { month: "2026-07-01", label: "Juillet 2026", balance: 1000 },
      { month: "2026-08-01", label: "Août 2026", balance: 1700 },
      { month: "2026-09-01", label: "Septembre 2026", balance: 1650 },
    ])
  })

  it("rejects an invalid date", async () => {
    const response = await createDashboardRoutes(db, () => TODAY).request("/?date=septembre")
    expect(response.status).toBe(400)
  })
})
