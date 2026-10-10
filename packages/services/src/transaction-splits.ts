import { roundCents, splitsBalance, type TransactionSplit, type TransactionUnsplit } from "@centime/core"
import { categories, type Db, type DbExecutor, transactions, transactionSplits } from "@centime/db"
import { and, asc, eq, inArray, isNull } from "drizzle-orm"
import { isActiveCategory } from "./categories"
import { type Clock, nowIso, systemClock } from "./clock"
import { notFound, ServiceError } from "./errors"

const NOT_FOUND = "Transaction introuvable"
const UNBALANCED = "La somme des montants doit égaler le montant de la transaction"
const UNKNOWN_CATEGORY = "Catégorie introuvable"
const QUERY_CHUNK_SIZE = 500

export type TransactionSplitItem = Awaited<ReturnType<typeof selectSplits>>[number]

function selectSplits(db: DbExecutor, transactionIds: string[]) {
  return db
    .select({
      id: transactionSplits.id,
      transactionId: transactionSplits.transactionId,
      categoryId: transactionSplits.categoryId,
      categoryName: categories.name,
      categoryColor: categories.color,
      amount: transactionSplits.amount,
      note: transactionSplits.note,
    })
    .from(transactionSplits)
    .leftJoin(categories, eq(transactionSplits.categoryId, categories.id))
    .where(and(inArray(transactionSplits.transactionId, transactionIds), isNull(transactionSplits.deletedAt)))
    .orderBy(asc(transactionSplits.position))
}

export async function loadTransactionSplits(
  db: DbExecutor,
  transactionIds: string[],
): Promise<Map<string, TransactionSplitItem[]>> {
  const grouped = new Map<string, TransactionSplitItem[]>()
  for (let start = 0; start < transactionIds.length; start += QUERY_CHUNK_SIZE) {
    for (const split of await selectSplits(db, transactionIds.slice(start, start + QUERY_CHUNK_SIZE))) {
      grouped.set(split.transactionId, [...(grouped.get(split.transactionId) ?? []), split])
    }
  }
  return grouped
}

export async function discardSplits(db: DbExecutor, transactionIds: string[], clock: Clock = systemClock): Promise<void> {
  if (transactionIds.length === 0) return
  await db
    .update(transactionSplits)
    .set({ deletedAt: nowIso(clock) })
    .where(and(inArray(transactionSplits.transactionId, transactionIds), isNull(transactionSplits.deletedAt)))
}

async function requireTransaction(db: DbExecutor, id: string) {
  const [row] = await db
    .select({ id: transactions.id, amount: transactions.amount })
    .from(transactions)
    .where(and(eq(transactions.id, id), isNull(transactions.deletedAt)))
  if (!row) throw notFound(NOT_FOUND)
  return row
}

async function checkCategories(db: DbExecutor, splits: TransactionSplit["splits"]): Promise<void> {
  const categoryIds = new Set(splits.flatMap((split) => (split.categoryId === null ? [] : [split.categoryId])))
  for (const categoryId of categoryIds) {
    if (!(await isActiveCategory(db, categoryId))) throw new ServiceError(UNKNOWN_CATEGORY)
  }
}

function toSplitRows(transactionId: string, splits: TransactionSplit["splits"]) {
  return splits.map((split, position) => ({
    transactionId,
    categoryId: split.categoryId,
    amount: roundCents(split.amount),
    note: split.note,
    position,
  }))
}

async function withSplits(db: DbExecutor, transactionId: string) {
  const [transaction] = await db.select().from(transactions).where(eq(transactions.id, transactionId))
  if (!transaction) throw notFound(NOT_FOUND)
  const splits = await loadTransactionSplits(db, [transactionId])
  return { ...transaction, splits: splits.get(transactionId) ?? [] }
}

export async function splitTransaction(db: Db, input: TransactionSplit, clock: Clock = systemClock) {
  return db.transaction(async (tx) => {
    const transaction = await requireTransaction(tx, input.transactionId)
    if (!splitsBalance(transaction.amount, input.splits)) throw new ServiceError(UNBALANCED)
    await checkCategories(tx, input.splits)
    await discardSplits(tx, [transaction.id], clock)
    await tx.insert(transactionSplits).values(toSplitRows(transaction.id, input.splits))
    await tx
      .update(transactions)
      .set({ isSplit: true, categoryId: null, fixedItemId: null, isTransfer: false })
      .where(eq(transactions.id, transaction.id))
    return withSplits(tx, transaction.id)
  })
}

export async function unsplitTransaction(db: Db, { transactionId }: TransactionUnsplit, clock: Clock = systemClock) {
  return db.transaction(async (tx) => {
    const transaction = await requireTransaction(tx, transactionId)
    await discardSplits(tx, [transaction.id], clock)
    await tx.update(transactions).set({ isSplit: false }).where(eq(transactions.id, transaction.id))
    return withSplits(tx, transaction.id)
  })
}
