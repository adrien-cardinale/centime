import { accounts, categories, type Db, transactions } from "@centime/db"
import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "bun:test"
import { ServiceError } from "./errors"
import { pullChanges, pushChanges, stampUnversionedRows } from "./sync"
import { createTestAccount, createTestDb } from "./test-support/database"
import { updateTransaction } from "./transaction-updates"

const EARLY = "2026-01-01T08:00:00.000Z"
const LATER = "2026-01-02T08:00:00.000Z"
const LATEST = "2026-01-03T08:00:00.000Z"

let db: Db

function syncFields(updatedAt = EARLY) {
  return { id: crypto.randomUUID(), createdAt: EARLY, updatedAt, deletedAt: null, syncVersion: null }
}

function accountRow(identifier: string) {
  return { ...syncFields(), name: `Compte ${identifier}`, kind: "bank" as const, identifier, currency: "CHF" }
}

function categoryRow(name: string, updatedAt = EARLY) {
  return { ...syncFields(updatedAt), name, color: "#4a84c4", icon: null, themeId: null }
}

function transactionRow(accountId: string, fingerprint: string) {
  return {
    ...syncFields(),
    accountId,
    bookingDate: "2026-01-01",
    valueDate: null,
    rawLabel: "Achat fictif",
    merchant: null,
    providerCategory: null,
    amount: -12.5,
    currency: "CHF",
    status: "booked" as const,
    categoryId: null,
    fixedItemId: null,
    isTransfer: false,
    importId: null,
    sourceRef: null,
    fingerprint,
    balanceAfter: null,
  }
}

async function pullAll(since: number, limit: number) {
  const pages = []
  let cursor = since
  for (;;) {
    const page = await pullChanges(db, { since: cursor, limit })
    pages.push(page)
    cursor = page.cursor
    if (!page.hasMore) return { pages, cursor }
  }
}

beforeEach(async () => {
  db = await createTestDb()
})

describe("stampUnversionedRows", () => {
  it("numbers every pending row once and keeps the sequence when nothing changed", async () => {
    await createTestAccount(db)
    await db.insert(categories).values([{ name: "Alimentation", color: "#5b9a4f" }, { name: "Loisirs", color: "#c46a9e" }])
    const cursor = await stampUnversionedRows(db)
    expect(cursor).toBe(3)
    expect(await stampUnversionedRows(db)).toBe(3)
    const versions = (await db.select({ version: categories.syncVersion }).from(categories)).map((row) => row.version)
    expect(versions.sort()).toEqual([2, 3])
  })
})

describe("push then pull", () => {
  it("stores pushed rows and returns them from cursor 0", async () => {
    const account = accountRow("CH01")
    const transaction = transactionRow(account.id, "fp-1")
    const pushed = await pushChanges(db, { changes: { accounts: [account], transactions: [transaction] } })
    expect(pushed.rejected.accounts).toEqual([])
    expect(pushed.accepted.accounts).toEqual([{ id: account.id, syncVersion: 1 }])
    expect(pushed.accepted.transactions).toEqual([{ id: transaction.id, syncVersion: 2 }])
    expect(pushed.cursor).toBe(2)

    const pulled = await pullChanges(db, { since: 0 })
    expect(pulled).toMatchObject({ cursor: 2, hasMore: false })
    expect(pulled.changes.accounts).toEqual([{ ...account, syncVersion: 1 }])
    expect(pulled.changes.transactions).toEqual([{ ...transaction, syncVersion: 2 }])
    expect(pulled.changes.categories).toEqual([])
  })

  it("resets the version on a business update and returns the row on the next pull", async () => {
    const accountId = await createTestAccount(db)
    const [created] = await db.insert(transactions).values(transactionRow(accountId, "fp-2")).returning()
    const { cursor } = await pullChanges(db, { since: 0 })

    await updateTransaction(db, { id: created?.id ?? "", isTransfer: true })

    const stored = await db.query.transactions.findFirst({ where: eq(transactions.id, created?.id ?? "") })
    expect(stored?.syncVersion).toBeNull()
    const next = await pullChanges(db, { since: cursor })
    expect(next.changes.transactions).toMatchObject([{ id: created?.id, isTransfer: true }])
    expect(next.changes.accounts).toEqual([])
    expect(next.cursor).toBeGreaterThan(cursor)
  })

  it("accepts a category pushed before its theme", async () => {
    const theme = { ...syncFields(LATER), name: "Thème", color: "#4a84c4", icon: null }
    const category = { ...categoryRow("Catégorie"), themeId: theme.id }
    const result = await pushChanges(db, { changes: { categories: [category], themes: [theme] } })
    expect(result.accepted.categories).toHaveLength(1)
    expect(result.accepted.themes).toHaveLength(1)
  })

  it("rejects an unknown column", async () => {
    const row = { ...categoryRow("Test"), secret: "x" }
    await expect(pushChanges(db, { changes: { categories: [row] } })).rejects.toBeInstanceOf(ServiceError)
  })
})

describe("last write wins", () => {
  it("keeps the server row when the pushed row is older", async () => {
    const serverRow = categoryRow("Serveur", LATER)
    await pushChanges(db, { changes: { categories: [serverRow] } })

    const result = await pushChanges(db, { changes: { categories: [{ ...serverRow, name: "Client", updatedAt: EARLY }] } })

    expect(result.accepted.categories).toEqual([])
    expect(result.rejected.categories).toMatchObject([{ id: serverRow.id, name: "Serveur" }])
    expect(await db.query.categories.findFirst()).toMatchObject({ name: "Serveur" })
  })

  it("overwrites the server row when the pushed row is newer and keeps createdAt", async () => {
    const serverRow = categoryRow("Serveur", LATER)
    await pushChanges(db, { changes: { categories: [serverRow] } })

    const pushed = { ...serverRow, name: "Client", createdAt: LATEST, updatedAt: LATEST }
    const result = await pushChanges(db, { changes: { categories: [pushed] } })

    expect(result.rejected.categories).toEqual([])
    expect(result.accepted.categories).toEqual([{ id: serverRow.id, syncVersion: 2 }])
    expect(await db.query.categories.findFirst()).toMatchObject({
      name: "Client",
      createdAt: EARLY,
      updatedAt: LATEST,
      syncVersion: 2,
    })
  })
})

describe("business key collisions", () => {
  it("rejects a transaction whose fingerprint belongs to another id", async () => {
    const accountId = await createTestAccount(db)
    const [existing] = await db.insert(transactions).values(transactionRow(accountId, "fp-dup")).returning()

    const result = await pushChanges(db, { changes: { transactions: [transactionRow(accountId, "fp-dup")] } })

    expect(result.accepted.transactions).toEqual([])
    expect(result.rejected.transactions).toMatchObject([{ id: existing?.id, fingerprint: "fp-dup" }])
    expect(await db.select().from(transactions)).toHaveLength(1)
  })

  it("rejects an account whose identifier belongs to another id", async () => {
    await createTestAccount(db, "CH99")
    const result = await pushChanges(db, { changes: { accounts: [accountRow("CH99")] } })
    expect(result.rejected.accounts).toMatchObject([{ identifier: "CH99" }])
    expect(await db.select().from(accounts)).toHaveLength(1)
  })
})

describe("pull pagination", () => {
  it("splits the changes into complete pages", async () => {
    const account = accountRow("CH02")
    const names = ["A", "B", "C", "D", "E"]
    await pushChanges(db, { changes: { accounts: [account], categories: names.map((name) => categoryRow(name)) } })

    const { pages, cursor } = await pullAll(0, 2)

    expect(cursor).toBe(6)
    expect(pages.map((page) => page.hasMore)).toEqual([true, true, false])
    expect(pages[0]?.changes.accounts).toHaveLength(1)
    expect(pages.every((page) => page.changes.categories.length <= 2)).toBe(true)
    const pulledNames = pages.flatMap((page) => page.changes.categories.map((row) => ("name" in row ? row.name : "")))
    expect(pulledNames.sort()).toEqual(names)
  })

  it("never returns a row twice across pages", async () => {
    await pushChanges(db, { changes: { categories: ["A", "B", "C"].map((name) => categoryRow(name)) } })
    const { pages } = await pullAll(0, 1)
    const ids = pages.flatMap((page) => page.changes.categories.map((row) => row.id))
    expect(new Set(ids).size).toBe(3)
    expect(ids).toHaveLength(3)
  })
})
