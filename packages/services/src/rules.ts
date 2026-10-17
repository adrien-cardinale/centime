import { applyCompiledRules, compileRules, type RuleMatcherInput, type RulePayload } from "@centime/core"
import { type Db, rules, transactions } from "@centime/db"
import { and, asc, desc, eq, isNull } from "drizzle-orm"
import { z } from "zod"
import { isActiveCategory } from "./categories"
import { type ApplyRulesResult, categorizeTransactions, loadCategorizableTransactions } from "./categorize"
import { type Clock, nowIso, systemClock } from "./clock"
import { notFound, ServiceError } from "./errors"

export const applyRulesInputSchema = z.object({ scope: z.enum(["uncategorized", "all"]) })

export type ApplyRulesInput = z.infer<typeof applyRulesInputSchema>

export type RuleUpdate = RulePayload & { id: string }

const SAMPLE_SIZE = 10
const NOT_FOUND = "Règle introuvable"

function activeRule(id: string) {
  return and(eq(rules.id, id), isNull(rules.deletedAt))
}

async function assertValidTarget(db: Db, input: RulePayload): Promise<void> {
  if (input.categoryId !== null && !(await isActiveCategory(db, input.categoryId))) {
    throw new ServiceError("Catégorie introuvable")
  }
}

export function listRules(db: Db) {
  return db.select().from(rules).where(isNull(rules.deletedAt)).orderBy(desc(rules.priority), asc(rules.createdAt))
}

export async function createRule(db: Db, input: RulePayload) {
  await assertValidTarget(db, input)
  const [created] = await db.insert(rules).values(input).returning()
  if (!created) throw new Error("Insertion de la règle impossible")
  return created
}

export async function updateRule(db: Db, { id, ...input }: RuleUpdate) {
  await assertValidTarget(db, input)
  const [updated] = await db.update(rules).set(input).where(activeRule(id)).returning()
  if (!updated) throw notFound(NOT_FOUND)
  return updated
}

export async function deleteRule(db: Db, { id }: { id: string }, clock: Clock = systemClock) {
  const [deleted] = await db
    .update(rules)
    .set({ deletedAt: nowIso(clock) })
    .where(activeRule(id))
    .returning({ id: rules.id })
  if (!deleted) throw notFound(NOT_FOUND)
  return { id: deleted.id }
}

export async function testRule(db: Db, matcher: RuleMatcherInput) {
  const { compiled } = compileRules([{ ...matcher, id: "test", categoryId: null, markAsTransfer: false, priority: 0 }])
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

export function applyRules(db: Db, { scope }: ApplyRulesInput): Promise<ApplyRulesResult> {
  return db.transaction(async (tx) => categorizeTransactions(tx, await loadCategorizableTransactions(tx), scope))
}
