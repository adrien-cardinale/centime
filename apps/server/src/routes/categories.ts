import { type CategoryInput, categoryInputSchema } from "@centime/core"
import { budgets, categories, type Db, type DbExecutor, fixedItems, rules, transactions } from "@centime/db"
import { and, count, eq, isNull } from "drizzle-orm"
import { Hono } from "hono"
import { z } from "zod"
import { validated } from "./validation"

const idParamSchema = z.object({ id: z.string().min(1) })

function activeCategory(id: string) {
  return and(eq(categories.id, id), isNull(categories.deletedAt))
}

async function listCategories(db: Db) {
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

function toRow(input: CategoryInput) {
  return { name: input.name, color: input.color, icon: input.icon ?? null, parentId: input.parentId ?? null }
}

async function detachCategory(db: DbExecutor, id: string): Promise<void> {
  await db.update(transactions).set({ categoryId: null }).where(eq(transactions.categoryId, id))
  await db.update(rules).set({ categoryId: null }).where(eq(rules.categoryId, id))
  await db.update(fixedItems).set({ categoryId: null }).where(eq(fixedItems.categoryId, id))
  await db
    .update(budgets)
    .set({ deletedAt: new Date().toISOString() })
    .where(and(eq(budgets.categoryId, id), isNull(budgets.deletedAt)))
  await db.update(categories).set({ parentId: null }).where(eq(categories.parentId, id))
}

export async function deleteCategory(db: Db, id: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [deleted] = await tx
      .update(categories)
      .set({ deletedAt: new Date().toISOString() })
      .where(activeCategory(id))
      .returning({ id: categories.id })
    if (!deleted) return false
    await detachCategory(tx, id)
    return true
  })
}

export function createCategoryRoutes(db: Db) {
  return new Hono()
    .get("/", async (c) => c.json(await listCategories(db), 200))
    .post("/", validated("json", categoryInputSchema), async (c) => {
      const input = c.req.valid("json")
      const invalidParent = await parentError(db, input.parentId ?? null, null)
      if (invalidParent) return c.json({ error: invalidParent }, 400)
      const [created] = await db.insert(categories).values(toRow(input)).returning()
      if (!created) throw new Error("Insertion de la catégorie impossible")
      return c.json(created, 201)
    })
    .put("/:id", validated("param", idParamSchema), validated("json", categoryInputSchema), async (c) => {
      const { id } = c.req.valid("param")
      const input = c.req.valid("json")
      const invalidParent = await parentError(db, input.parentId ?? null, id)
      if (invalidParent) return c.json({ error: invalidParent }, 400)
      const [updated] = await db.update(categories).set(toRow(input)).where(activeCategory(id)).returning()
      if (!updated) return c.json({ error: "Catégorie introuvable" }, 404)
      return c.json(updated, 200)
    })
    .delete("/:id", validated("param", idParamSchema), async (c) => {
      const { id } = c.req.valid("param")
      if (!(await deleteCategory(db, id))) return c.json({ error: "Catégorie introuvable" }, 404)
      return c.json({ id }, 200)
    })
}
