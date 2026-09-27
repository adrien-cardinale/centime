import { isoDateOf } from "@centime/core"
import { categories, type Db, type DbExecutor, fixedItems, transactions } from "@centime/db"
import { and, eq, inArray, isNull } from "drizzle-orm"
import { Hono } from "hono"
import { z } from "zod"
import { CSV_CONTENT_TYPE, exportFileName, exportTransactionsCsv } from "../services/transaction-export"
import { countTransactions, listTransactions, type TransactionFilter, transactionCondition } from "../services/transactions"
import type { Clock } from "./fixed-items"
import { validated } from "./validation"

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const booleanFlag = z.enum(["true", "false"]).optional()

const filterQuerySchema = z.object({
  accountId: z.string().min(1).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  search: z.string().trim().optional(),
  categoryId: z.string().min(1).optional(),
  includeChildren: booleanFlag,
  fixedItemId: z.string().min(1).optional(),
  isTransfer: booleanFlag,
})

const listQuerySchema = filterQuerySchema.extend({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
})

type FilterQuery = z.infer<typeof filterQuerySchema>

const MAX_BULK_IDS = 500

const changesFields = {
  categoryId: z.string().min(1).nullable().optional(),
  isTransfer: z.boolean().optional(),
  fixedItemId: z.string().min(1).nullable().optional(),
}

type Changes = {
  categoryId?: string | null | undefined
  isTransfer?: boolean | undefined
  fixedItemId?: string | null | undefined
}

function hasChanges(changes: Changes): boolean {
  return changes.categoryId !== undefined || changes.isTransfer !== undefined || changes.fixedItemId !== undefined
}

const NOTHING_TO_UPDATE = "Aucune modification demandée"

const updateSchema = z.object(changesFields).refine(hasChanges, NOTHING_TO_UPDATE)

const bulkUpdateSchema = z
  .object({
    ids: z
      .array(z.string().min(1))
      .min(1, "Sélectionnez au moins une transaction")
      .max(MAX_BULK_IDS, `${MAX_BULK_IDS} transactions au maximum`),
    ...changesFields,
  })
  .refine(hasChanges, NOTHING_TO_UPDATE)

const idParamSchema = z.object({ id: z.string().min(1) })

function flagOf(value: "true" | "false" | undefined): boolean | undefined {
  return value === undefined ? undefined : value === "true"
}

function toFilter(query: FilterQuery): TransactionFilter {
  return {
    ...query,
    includeChildren: flagOf(query.includeChildren),
    isTransfer: flagOf(query.isTransfer),
  }
}

async function categoryIsUsable(db: Db, categoryId: string | null | undefined): Promise<boolean> {
  if (!categoryId) return true
  const [row] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, categoryId), isNull(categories.deletedAt)))
  return row !== undefined
}

type FixedItemLookup = { found: false } | { found: true; categoryId: string | null }

async function lookupFixedItem(db: Db, fixedItemId: string | null | undefined): Promise<FixedItemLookup> {
  if (!fixedItemId) return { found: true, categoryId: null }
  const [row] = await db
    .select({ categoryId: fixedItems.categoryId })
    .from(fixedItems)
    .where(and(eq(fixedItems.id, fixedItemId), isNull(fixedItems.deletedAt)))
  return row ? { found: true, categoryId: row.categoryId } : { found: false }
}

function toUpdate(changes: Changes) {
  return {
    ...(changes.categoryId !== undefined && { categoryId: changes.categoryId }),
    ...(changes.isTransfer !== undefined && { isTransfer: changes.isTransfer }),
    ...(changes.fixedItemId !== undefined && { fixedItemId: changes.fixedItemId }),
  }
}

async function inheritFixedItemCategory(db: DbExecutor, ids: string[], categoryId: string): Promise<void> {
  await db
    .update(transactions)
    .set({ categoryId })
    .where(and(inArray(transactions.id, ids), isNull(transactions.categoryId), isNull(transactions.deletedAt)))
}

async function updateTransactions(db: Db, ids: string[], changes: Changes, inheritedCategoryId: string | null) {
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(transactions)
      .set(toUpdate(changes))
      .where(and(inArray(transactions.id, ids), isNull(transactions.deletedAt)))
      .returning({ id: transactions.id })
    if (inheritedCategoryId !== null && changes.categoryId === undefined) {
      await inheritFixedItemCategory(tx, ids, inheritedCategoryId)
    }
    return updated
  })
}

type ChangeCheck = { error: string } | { error: null; inheritedCategoryId: string | null }

async function checkChanges(db: Db, changes: Changes): Promise<ChangeCheck> {
  if (!(await categoryIsUsable(db, changes.categoryId))) return { error: UNKNOWN_CATEGORY }
  const fixedItem = await lookupFixedItem(db, changes.fixedItemId)
  if (!fixedItem.found) return { error: UNKNOWN_FIXED_ITEM }
  return { error: null, inheritedCategoryId: fixedItem.categoryId }
}

const UNKNOWN_CATEGORY = "Catégorie introuvable"
const UNKNOWN_FIXED_ITEM = "Poste fixe introuvable"

export function createTransactionRoutes(db: Db, clock: Clock = () => new Date()) {
  return new Hono()
    .get("/", validated("query", listQuerySchema), async (c) => {
      const { page, pageSize, ...query } = c.req.valid("query")
      const condition = await transactionCondition(db, toFilter(query))
      const window = { limit: pageSize, offset: (page - 1) * pageSize }
      const [items, total] = await Promise.all([
        listTransactions(db, condition, window),
        countTransactions(db, condition),
      ])
      return c.json({ items, total, page, pageSize }, 200)
    })
    .get("/export", validated("query", filterQuerySchema), async (c) => {
      const condition = await transactionCondition(db, toFilter(c.req.valid("query")))
      const csv = await exportTransactionsCsv(db, condition)
      return c.body(csv, 200, {
        "Content-Type": CSV_CONTENT_TYPE,
        "Content-Disposition": `attachment; filename="${exportFileName(isoDateOf(clock()))}"`,
      })
    })
    .patch("/", validated("json", bulkUpdateSchema), async (c) => {
      const { ids, ...changes } = c.req.valid("json")
      const check = await checkChanges(db, changes)
      if (check.error !== null) return c.json({ error: check.error }, 400)
      const updated = await updateTransactions(db, [...new Set(ids)], changes, check.inheritedCategoryId)
      return c.json({ updated: updated.length }, 200)
    })
    .patch("/:id", validated("param", idParamSchema), validated("json", updateSchema), async (c) => {
      const { id } = c.req.valid("param")
      const changes = c.req.valid("json")
      const check = await checkChanges(db, changes)
      if (check.error !== null) return c.json({ error: check.error }, 400)
      const [updated] = await updateTransactions(db, [id], changes, check.inheritedCategoryId)
      if (!updated) return c.json({ error: "Transaction introuvable" }, 404)
      return c.json({ id: updated.id }, 200)
    })
}
