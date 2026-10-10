import { categories, type Db, type DbExecutor, fixedItems, transactions } from "@centime/db"
import { and, eq, inArray, isNull } from "drizzle-orm"
import { z } from "zod"
import { notFound, ServiceError } from "./errors"
import { discardSplits } from "./transaction-splits"

const MAX_BULK_IDS = 500
const NOTHING_TO_UPDATE = "Aucune modification demandée"
const UNKNOWN_CATEGORY = "Catégorie introuvable"
const UNKNOWN_FIXED_ITEM = "Poste fixe introuvable"

export type TransactionChanges = {
  categoryId?: string | null | undefined
  isTransfer?: boolean | undefined
  fixedItemId?: string | null | undefined
}

export type TransactionUpdate = TransactionChanges & { id: string }
export type BulkTransactionUpdate = TransactionChanges & { ids: string[] }

function hasChanges(changes: TransactionChanges): boolean {
  return changes.categoryId !== undefined || changes.isTransfer !== undefined || changes.fixedItemId !== undefined
}

const changesFields = {
  categoryId: z.string().min(1).nullable().optional(),
  isTransfer: z.boolean().optional(),
  fixedItemId: z.string().min(1).nullable().optional(),
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

async function inheritedCategoryOf(db: DbExecutor, fixedItemId: string | null | undefined): Promise<string | null> {
  if (!fixedItemId) return null
  const [row] = await db
    .select({ categoryId: fixedItems.categoryId })
    .from(fixedItems)
    .where(and(eq(fixedItems.id, fixedItemId), isNull(fixedItems.deletedAt)))
  if (!row) throw new ServiceError(UNKNOWN_FIXED_ITEM)
  return row.categoryId
}

async function checkChanges(db: DbExecutor, changes: TransactionChanges): Promise<string | null> {
  if (!hasChanges(changes)) throw new ServiceError(NOTHING_TO_UPDATE)
  if (!(await categoryIsUsable(db, changes.categoryId))) throw new ServiceError(UNKNOWN_CATEGORY)
  return inheritedCategoryOf(db, changes.fixedItemId)
}

function dropsSplit(changes: TransactionChanges): boolean {
  return changes.categoryId !== undefined || Boolean(changes.fixedItemId) || changes.isTransfer === true
}

function toUpdate(changes: TransactionChanges) {
  return {
    ...(changes.categoryId !== undefined && { categoryId: changes.categoryId }),
    ...(changes.isTransfer !== undefined && { isTransfer: changes.isTransfer }),
    ...(changes.fixedItemId !== undefined && { fixedItemId: changes.fixedItemId }),
    ...(dropsSplit(changes) && { isSplit: false }),
  }
}

async function inheritFixedItemCategory(db: DbExecutor, ids: string[], categoryId: string): Promise<void> {
  await db
    .update(transactions)
    .set({ categoryId })
    .where(and(inArray(transactions.id, ids), isNull(transactions.categoryId), isNull(transactions.deletedAt)))
}

async function applyChanges(db: Db, ids: string[], changes: TransactionChanges) {
  const inheritedCategoryId = await checkChanges(db, changes)
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(transactions)
      .set(toUpdate(changes))
      .where(and(inArray(transactions.id, ids), isNull(transactions.deletedAt)))
      .returning({ id: transactions.id })
    if (dropsSplit(changes)) await discardSplits(tx, updated.map((row) => row.id))
    if (inheritedCategoryId !== null && changes.categoryId === undefined) {
      await inheritFixedItemCategory(tx, ids, inheritedCategoryId)
    }
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
