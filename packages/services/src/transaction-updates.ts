import { categories, type Db, type DbExecutor, transactions } from "@centime/db"
import { and, eq, inArray, isNull } from "drizzle-orm"
import { z } from "zod"
import { notFound, ServiceError } from "./errors"
import { discardSplits } from "./transaction-splits"

const MAX_BULK_IDS = 500
const NOTHING_TO_UPDATE = "Aucune modification demandée"
const UNKNOWN_CATEGORY = "Catégorie introuvable"

export type TransactionChanges = {
  categoryId?: string | null | undefined
  isTransfer?: boolean | undefined
}

export type TransactionUpdate = TransactionChanges & { id: string }
export type BulkTransactionUpdate = TransactionChanges & { ids: string[] }

function hasChanges(changes: TransactionChanges): boolean {
  return changes.categoryId !== undefined || changes.isTransfer !== undefined
}

const changesFields = {
  categoryId: z.string().min(1).nullable().optional(),
  isTransfer: z.boolean().optional(),
}

export const transactionChangesSchema = z.object(changesFields).refine(hasChanges, NOTHING_TO_UPDATE)

export const bulkTransactionUpdateSchema = z
  .object({
    ids: z
      .array(z.string().min(1))
      .min(1, "Sélectionnez au moins une transaction")
      .max(MAX_BULK_IDS, `${MAX_BULK_IDS} transactions au maximum`),
    ...changesFields,
  })
  .refine(hasChanges, NOTHING_TO_UPDATE)

async function categoryIsUsable(db: DbExecutor, categoryId: string | null | undefined): Promise<boolean> {
  if (!categoryId) return true
  const [row] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, categoryId), isNull(categories.deletedAt)))
  return row !== undefined
}

async function checkChanges(db: DbExecutor, changes: TransactionChanges): Promise<void> {
  if (!hasChanges(changes)) throw new ServiceError(NOTHING_TO_UPDATE)
  if (!(await categoryIsUsable(db, changes.categoryId))) throw new ServiceError(UNKNOWN_CATEGORY)
}

function dropsSplit(changes: TransactionChanges): boolean {
  return changes.categoryId !== undefined || changes.isTransfer === true
}

function toUpdate(changes: TransactionChanges) {
  return {
    ...(changes.categoryId !== undefined && { categoryId: changes.categoryId }),
    ...(changes.isTransfer !== undefined && { isTransfer: changes.isTransfer }),
    ...(dropsSplit(changes) && { isSplit: false }),
  }
}

async function applyChanges(db: Db, ids: string[], changes: TransactionChanges) {
  await checkChanges(db, changes)
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(transactions)
      .set(toUpdate(changes))
      .where(and(inArray(transactions.id, ids), isNull(transactions.deletedAt)))
      .returning({ id: transactions.id })
    if (dropsSplit(changes))
      await discardSplits(
        tx,
        updated.map((row) => row.id),
      )
    return updated
  })
}

export async function updateTransaction(db: Db, { id, ...changes }: TransactionUpdate) {
  const [updated] = await applyChanges(db, [id], changes)
  if (!updated) throw notFound("Transaction introuvable")
  return { id: updated.id }
}

export async function bulkUpdateTransactions(db: Db, { ids, ...changes }: BulkTransactionUpdate) {
  const updated = await applyChanges(db, [...new Set(ids)], changes)
  return { updated: updated.length }
}
