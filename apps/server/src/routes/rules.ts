import { applyCompiledRules, compileRules, type RuleMatcherInput, ruleMatcherSchema, type RulePayload, rulePayloadSchema } from "@centime/core"
import { categories, type Db, fixedItems, rules, transactions } from "@centime/db"
import { and, asc, desc, eq, isNull } from "drizzle-orm"
import { Hono } from "hono"
import { z } from "zod"
import { categorizeTransactions, loadCategorizableTransactions } from "../services/categorize"
import { validated } from "./validation"

const idParamSchema = z.object({ id: z.string().min(1) })
const applySchema = z.object({ scope: z.enum(["uncategorized", "all"]) })

const SAMPLE_SIZE = 10

function activeRule(id: string) {
  return and(eq(rules.id, id), isNull(rules.deletedAt))
}

async function isActiveCategory(db: Db, id: string): Promise<boolean> {
  const [row] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, id), isNull(categories.deletedAt)))
  return row !== undefined
}

async function isActiveFixedItem(db: Db, id: string): Promise<boolean> {
  const [row] = await db
    .select({ id: fixedItems.id })
    .from(fixedItems)
    .where(and(eq(fixedItems.id, id), isNull(fixedItems.deletedAt)))
  return row !== undefined
}

async function targetError(db: Db, input: RulePayload): Promise<string | null> {
  if (input.categoryId !== null && !(await isActiveCategory(db, input.categoryId))) return "Catégorie introuvable"
  if (input.fixedItemId && !(await isActiveFixedItem(db, input.fixedItemId))) return "Charge fixe introuvable"
  return null
}

function toRow(input: RulePayload) {
  return { ...input, fixedItemId: input.fixedItemId ?? null }
}

function listRules(db: Db) {
  return db
    .select()
    .from(rules)
    .where(isNull(rules.deletedAt))
    .orderBy(desc(rules.priority), asc(rules.createdAt))
}

async function testRule(db: Db, matcher: RuleMatcherInput) {
  const { compiled } = compileRules([
    { ...matcher, id: "test", categoryId: null, fixedItemId: null, markAsTransfer: false, priority: 0 },
  ])
  const rows = await db
    .select({
      id: transactions.id,
      bookingDate: transactions.bookingDate,
      rawLabel: transactions.rawLabel,
      merchant: transactions.merchant,
      providerCategory: transactions.providerCategory,
      amount: transactions.amount,
    })
    .from(transactions)
    .where(isNull(transactions.deletedAt))
    .orderBy(desc(transactions.bookingDate), desc(transactions.createdAt))
  const matches = rows.filter((row) => applyCompiledRules(compiled, row) !== null)
  return {
    count: matches.length,
    samples: matches.slice(0, SAMPLE_SIZE).map(({ id, bookingDate, rawLabel, merchant, amount }) => ({
      id,
      bookingDate,
      rawLabel,
      merchant,
      amount,
    })),
  }
}

export function createRuleRoutes(db: Db) {
  return new Hono()
    .get("/", async (c) => c.json(await listRules(db), 200))
    .post("/test", validated("json", ruleMatcherSchema), async (c) => c.json(await testRule(db, c.req.valid("json")), 200))
    .post("/apply", validated("json", applySchema), async (c) => {
      const { scope } = c.req.valid("json")
      const result = await db.transaction(async (tx) =>
        categorizeTransactions(tx, await loadCategorizableTransactions(tx), scope),
      )
      return c.json(result, 200)
    })
    .post("/", validated("json", rulePayloadSchema), async (c) => {
      const input = c.req.valid("json")
      const invalidTarget = await targetError(db, input)
      if (invalidTarget) return c.json({ error: invalidTarget }, 400)
      const [created] = await db.insert(rules).values(toRow(input)).returning()
      if (!created) throw new Error("Insertion de la règle impossible")
      return c.json(created, 201)
    })
    .put("/:id", validated("param", idParamSchema), validated("json", rulePayloadSchema), async (c) => {
      const { id } = c.req.valid("param")
      const input = c.req.valid("json")
      const invalidTarget = await targetError(db, input)
      if (invalidTarget) return c.json({ error: invalidTarget }, 400)
      const [updated] = await db.update(rules).set(toRow(input)).where(activeRule(id)).returning()
      if (!updated) return c.json({ error: "Règle introuvable" }, 404)
      return c.json(updated, 200)
    })
    .delete("/:id", validated("param", idParamSchema), async (c) => {
      const { id } = c.req.valid("param")
      const [deleted] = await db
        .update(rules)
        .set({ deletedAt: new Date().toISOString() })
        .where(activeRule(id))
        .returning({ id: rules.id })
      if (!deleted) return c.json({ error: "Règle introuvable" }, 404)
      return c.json({ id: deleted.id }, 200)
    })
}
