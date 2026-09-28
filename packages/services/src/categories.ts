import type { CategoryInput } from "@centime/core"
import { budgets, categories, type Db, type DbExecutor, fixedItems, rules, transactions } from "@centime/db"
import { and, count, eq, isNull } from "drizzle-orm"
import { type Clock, nowIso, systemClock } from "./clock"
import { notFound, ServiceError } from "./errors"

export type CategoryNode = { id: string; name: string; color: string; parentId: string | null }

export type CategoryUpdate = CategoryInput & { id: string }

const NOT_FOUND = "Catégorie introuvable"

export function loadCategoryNodes(db: DbExecutor): Promise<CategoryNode[]> {
  return db
    .select({ id: categories.id, name: categories.name, color: categories.color, parentId: categories.parentId })
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

export async function listCategories(db: Db) {
  const rows = await db
    .select({
      id: categories.id,
      name: categories.name,
      color: categories.color,
      icon: categories.icon,
      parentId: categories.parentId,
      transactionCount: count(transactions.id),
    })
    .from(categories)
    .leftJoin(transactions, and(eq(transactions.categoryId, categories.id), isNull(transactions.deletedAt)))
    .where(isNull(categories.deletedAt))
    .groupBy(categories.id)
  return rows.sort((left, right) => left.name.localeCompare(right.name, "fr"))
}

async function findParentId(db: DbExecutor, id: string): Promise<string | null | undefined> {
  const [row] = await db.select({ parentId: categories.parentId }).from(categories).where(activeCategory(id))
  return row?.parentId
}

async function descendsFrom(db: DbExecutor, startId: string, ancestorId: string): Promise<boolean> {
  const visited = new Set<string>()
  let current: string | null | undefined = startId
  while (current && !visited.has(current)) {
    if (current === ancestorId) return true
    visited.add(current)
    current = await findParentId(db, current)
  }
  return false
}

async function parentError(db: DbExecutor, parentId: string | null, categoryId: string | null): Promise<string | null> {
  if (parentId === null) return null
  if (parentId === categoryId) return "Une catégorie ne peut pas être son propre parent"
  if ((await findParentId(db, parentId)) === undefined) return "Catégorie parente introuvable"
  if (categoryId !== null && (await descendsFrom(db, parentId, categoryId))) {
    return "Une sous-catégorie ne peut pas devenir le parent de sa catégorie"
  }
  return null
}

async function assertValidParent(db: DbExecutor, parentId: string | null, categoryId: string | null): Promise<void> {
  const error = await parentError(db, parentId, categoryId)
  if (error) throw new ServiceError(error)
}

function toRow(input: CategoryInput) {
  return { name: input.name, color: input.color, icon: input.icon ?? null, parentId: input.parentId ?? null }
}

export async function createCategory(db: Db, input: CategoryInput) {
  await assertValidParent(db, input.parentId ?? null, null)
  const [created] = await db.insert(categories).values(toRow(input)).returning()
  if (!created) throw new Error("Insertion de la catégorie impossible")
  return created
}

export async function updateCategory(db: Db, { id, ...input }: CategoryUpdate) {
  await assertValidParent(db, input.parentId ?? null, id)
  const [updated] = await db.update(categories).set(toRow(input)).where(activeCategory(id)).returning()
  if (!updated) throw notFound(NOT_FOUND)
  return updated
}

async function detachCategory(db: DbExecutor, id: string, deletedAt: string): Promise<void> {
  await db.update(transactions).set({ categoryId: null }).where(eq(transactions.categoryId, id))
  await db.update(rules).set({ categoryId: null }).where(eq(rules.categoryId, id))
  await db.update(fixedItems).set({ categoryId: null }).where(eq(fixedItems.categoryId, id))
  await db
    .update(budgets)
    .set({ deletedAt })
    .where(and(eq(budgets.categoryId, id), isNull(budgets.deletedAt)))
  await db.update(categories).set({ parentId: null }).where(eq(categories.parentId, id))
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
