import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"
import { createDb, runMigrations, type Db } from "./client"
import { accounts, transactions } from "./schema"

let db: Db

beforeEach(async () => {
  db = createDb(":memory:")
  await runMigrations(db)
})

describe("createDb", () => {
  it("applies migrations and fills sync columns", async () => {
    const [account] = await db
      .insert(accounts)
      .values({ name: "Compte courant", kind: "bank", identifier: "CH00 0000 0000 0000 0000 0" })
      .returning()

    expect(account?.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(account?.currency).toBe("CHF")
    const createdAt = Date.parse(account?.createdAt ?? "")
    const updatedAt = Date.parse(account?.updatedAt ?? "")
    expect(updatedAt - createdAt).toBeGreaterThanOrEqual(0)
    expect(updatedAt - createdAt).toBeLessThan(1000)
    expect(account?.deletedAt).toBeNull()
  })

  it("rejects a duplicate transaction fingerprint", async () => {
    const [account] = await db
      .insert(accounts)
      .values({ name: "Carte", kind: "card", identifier: "**** 1234" })
      .returning()
    const accountId = account?.id ?? ""
    const transaction = {
      accountId,
      bookingDate: "2026-09-26",
      rawLabel: "Migros",
      amount: -12.3,
      currency: "CHF",
      status: "booked" as const,
      fingerprint: "abc",
    }

    await db.insert(transactions).values(transaction)
    await expect(db.insert(transactions).values(transaction)).rejects.toThrow()

    const stored = await db.select().from(transactions).where(eq(transactions.accountId, accountId))
    expect(stored).toHaveLength(1)
    expect(stored[0]?.isTransfer).toBe(false)
  })
})
