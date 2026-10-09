import { computeTransactionFingerprint, type ManualTransaction } from "@centime/core"
import { accounts, categories, type Db, type DbExecutor, fixedItems, transactions } from "@centime/db"
import { and, eq, isNull } from "drizzle-orm"
import { notFound, ServiceError } from "./errors"

const MAX_OCCURRENCES = 100

async function accountCurrency(db: DbExecutor, accountId: string): Promise<string> {
  const [account] = await db
    .select({ currency: accounts.currency })
    .from(accounts)
    .where(and(eq(accounts.id, accountId), isNull(accounts.deletedAt)))
  if (!account) throw notFound("Compte introuvable")
  return account.currency
}

async function checkCategory(db: DbExecutor, categoryId: string | null): Promise<void> {
  if (categoryId === null) return
  const [category] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, categoryId), isNull(categories.deletedAt)))
  if (!category) throw new ServiceError("Catégorie introuvable")
}

async function fixedItemCategory(db: DbExecutor, fixedItemId: string | null): Promise<string | null> {
  if (fixedItemId === null) return null
  const [fixedItem] = await db
    .select({ categoryId: fixedItems.categoryId })
    .from(fixedItems)
    .where(and(eq(fixedItems.id, fixedItemId), isNull(fixedItems.deletedAt)))
  if (!fixedItem) throw new ServiceError("Poste fixe introuvable")
  return fixedItem.categoryId
}

// L'empreinte est unique sur toute la table, y compris les lignes supprimées : on avance l'occurrence
// jusqu'à en trouver une libre, comme le fait l'import pour plusieurs lignes identiques d'un relevé.
async function freeFingerprint(db: DbExecutor, input: ManualTransaction): Promise<string> {
  for (let occurrence = 0; occurrence < MAX_OCCURRENCES; occurrence++) {
    const fingerprint = computeTransactionFingerprint({
      accountId: input.accountId,
      bookingDate: input.bookingDate,
      amount: input.amount,
      label: input.rawLabel,
      occurrence,
    })
    const [existing] = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(eq(transactions.fingerprint, fingerprint))
    if (!existing) return fingerprint
  }
  throw new ServiceError("Trop de transactions identiques le même jour")
}

export async function createTransaction(db: Db, input: ManualTransaction) {
  return db.transaction(async (tx) => {
    const currency = await accountCurrency(tx, input.accountId)
    await checkCategory(tx, input.categoryId)
    const inheritedCategoryId = await fixedItemCategory(tx, input.fixedItemId)
    const [created] = await tx
      .insert(transactions)
      .values({
        accountId: input.accountId,
        bookingDate: input.bookingDate,
        rawLabel: input.rawLabel,
        merchant: input.merchant,
        amount: input.amount,
        currency,
        status: input.status,
        categoryId: input.categoryId ?? inheritedCategoryId,
        fixedItemId: input.fixedItemId,
        isTransfer: input.isTransfer,
        fingerprint: await freeFingerprint(tx, input),
      })
      .returning()
    if (!created) throw new Error("Insertion de la transaction impossible")
    return created
  })
}
