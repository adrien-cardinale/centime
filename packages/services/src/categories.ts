import type { CategoryInput } from "@centime/core"
import {
  budgets,
  categories,
  type Db,
  type DbExecutor,
  fixedItems,
  rules,
  themes,
  transactions,
  transactionSplits,
} from "@centime/db"
import { and, eq, isNull, sql } from "drizzle-orm"
import { type Clock, nowIso, systemClock } from "./clock"
import { notFound, ServiceError } from "./errors"

export type CategoryNode = { id: string; name: string; color: string; themeId: string | null }

export type CategoryUpdate = CategoryInput & { id: string }

const NOT_FOUND = "Catégorie introuvable"

export function loadCategoryNodes(db: DbExecutor): Promise<CategoryNode[]> {
  return db
    .select({ id: categories.id, name: categories.name, color: categories.color, themeId: categories.themeId })
    .from(categories)
    .where(isNull(categories.deletedAt))
}

function activeCategory(id: string) {
  return and(eq(categories.id, id), isNull(categories.deletedAt))
}

export async function isActiveCategory(db: DbExecutor, id: string | null | undefined): Promise<boolean> {
  if (!id) return true
  const [row] = await db.select({ id: categories.id }).from(categories).where(activeCategory(id))
  return row !== undefined
}

const directTransactionCount = sql<number>`(select count(*) from ${transactions} where ${and(
  eq(transactions.categoryId, categories.id),
  isNull(transactions.deletedAt),
  eq(transactions.isSplit, false),
)})`

const splitTransactionCount = sql<number>`(select count(distinct ${transactionSplits.transactionId}) from ${transactionSplits}
  inner join ${transactions} on ${eq(transactions.id, transactionSplits.transactionId)}
  where ${and(
    eq(transactionSplits.categoryId, categories.id),
    isNull(transactionSplits.deletedAt),
    isNull(transactions.deletedAt),
    eq(transactions.isSplit, true),
  )})`

export async function listCategories(db: Db) {
  const rows = await db
    .select({
      id: categories.id,
      name: categories.name,
      color: categories.color,
      icon: categories.icon,
      themeId: categories.themeId,
      transactionCount: sql<number>`${directTransactionCount} + ${splitTransactionCount}`.mapWith(Number),
    })
    .from(categories)
    .where(isNull(categories.deletedAt))
  return rows.sort((left, right) => left.name.localeCompare(right.name, "fr"))
}

async function assertActiveTheme(db: DbExecutor, themeId: string | null): Promise<void> {
  if (themeId === null) return
  const [row] = await db.select({ id: themes.id }).from(themes).where(and(eq(themes.id, themeId), isNull(themes.deletedAt)))
  if (!row) throw new ServiceError("Thème introuvable")
}

function toRow(input: CategoryInput) {
  return { name: input.name, color: input.color, icon: input.icon ?? null, themeId: input.themeId ?? null }
}

export async function createCategory(db: Db, input: CategoryInput) {
  await assertActiveTheme(db, input.themeId ?? null)
  const [created] = await db.insert(categories).values(toRow(input)).returning()
  if (!created) throw new Error("Insertion de la catégorie impossible")
  return created
}

export async function updateCategory(db: Db, { id, ...input }: CategoryUpdate) {
  await assertActiveTheme(db, input.themeId ?? null)
  const [updated] = await db.update(categories).set(toRow(input)).where(activeCategory(id)).returning()
  if (!updated) throw notFound(NOT_FOUND)
  return updated
}

async function detachCategory(db: DbExecutor, id: string, deletedAt: string): Promise<void> {
  await db.update(transactions).set({ categoryId: null }).where(eq(transactions.categoryId, id))
  await db.update(transactionSplits).set({ categoryId: null }).where(eq(transactionSplits.categoryId, id))
  await db.update(rules).set({ categoryId: null }).where(eq(rules.categoryId, id))
  await db.update(fixedItems).set({ categoryId: null }).where(eq(fixedItems.categoryId, id))
  await db
    .update(budgets)
    .set({ deletedAt })
    .where(and(eq(budgets.categoryId, id), isNull(budgets.deletedAt)))
}

export async function deleteCategory(db: Db, { id }: { id: string }, clock: Clock = systemClock) {
  const deletedAt = nowIso(clock)
  const deleted = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(categories)
      .set({ deletedAt })
      .where(activeCategory(id))
      .returning({ id: categories.id })
    if (row) await detachCategory(tx, id, deletedAt)
    return row !== undefined
  })
  if (!deleted) throw notFound(NOT_FOUND)
  return { id }
}
