import { accounts, type Db, runMigrations, transactions } from "@centime/db"
import { createDb } from "@centime/db/node"
import { Hono } from "hono"
import { handleError } from "../errors"

export async function createTestDb(): Promise<Db> {
  const db = createDb(":memory:")
  await runMigrations(db)
  return db
}

export function withErrorHandling(routes: Hono): Hono {
  return new Hono().onError(handleError).route("/", routes)
}
export async function createTestAccount(db: Db): Promise<string> {
  const [account] = await db
    .insert(accounts)
    .values({ name: "Compte test", kind: "bank", identifier: "CH0000000000000000000" })
    .returning({ id: accounts.id })
  if (!account) throw new Error("Compte de test impossible à créer")
  return account.id
}

type TestTransaction = {
  rawLabel: string
  merchant?: string | null
  providerCategory?: string | null
  categoryId?: string | null
  fixedItemId?: string | null
  isTransfer?: boolean
  bookingDate?: string
  amount?: number
  status?: "booked" | "pending"
}

export async function insertTestTransactions(db: Db, accountId: string, entries: TestTransaction[]): Promise<string[]> {
  const rows = await db
    .insert(transactions)
    .values(
      entries.map((entry, index) => ({
        accountId,
        bookingDate: entry.bookingDate ?? "2026-03-01",
        rawLabel: entry.rawLabel,
        merchant: entry.merchant ?? null,
        providerCategory: entry.providerCategory ?? null,
        amount: entry.amount ?? -10 - index,
        currency: "CHF",
        status: entry.status ?? "booked",
        categoryId: entry.categoryId ?? null,
        fixedItemId: entry.fixedItemId ?? null,
        isTransfer: entry.isTransfer ?? false,
        fingerprint: `fp-${index}-${entry.rawLabel}`,
      })),
    )
    .returning({ id: transactions.id })
  return rows.map((row) => row.id)
}

export async function readJson<Body>(response: Response): Promise<Body> {
  return (await response.json()) as Body
}
