import type { RuleMatcherInput } from "@centime/core"
import { type DbExecutor, rules } from "@centime/db"
import { and, asc, eq, isNotNull, isNull } from "drizzle-orm"
import { categorizeTransactions, loadCategorizableTransactions } from "./categorize"
import { type Clock, nowIso } from "./clock"

const BUDGET_RULE_PRIORITY = 60

export type LinkedRule = RuleMatcherInput & { id: string }

type RuleChange = RuleMatcherInput | null | undefined

function linkedRuleCondition(categoryId: string) {
  return and(eq(rules.categoryId, categoryId), eq(rules.markAsTransfer, false), isNull(rules.deletedAt))
}

export async function loadLinkedRules(db: DbExecutor): Promise<Map<string, LinkedRule>> {
  const rows = await db
    .select({
      id: rules.id,
      categoryId: rules.categoryId,
      pattern: rules.pattern,
      matchKind: rules.matchKind,
      field: rules.field,
    })
    .from(rules)
    .where(and(isNotNull(rules.categoryId), eq(rules.markAsTransfer, false), isNull(rules.deletedAt)))
    .orderBy(asc(rules.createdAt))
  const byCategory = new Map<string, LinkedRule>()
  for (const { categoryId, ...rule } of rows) {
    if (categoryId !== null && !byCategory.has(categoryId)) byCategory.set(categoryId, rule)
  }
  return byCategory
}

async function findLinkedRule(db: DbExecutor, categoryId: string | null) {
  if (categoryId === null) return undefined
  const [existing] = await db
    .select({ id: rules.id })
    .from(rules)
    .where(linkedRuleCondition(categoryId))
    .orderBy(asc(rules.createdAt))
    .limit(1)
  return existing
}

export async function syncLinkedRule(
  db: DbExecutor,
  previousCategoryId: string | null,
  categoryId: string,
  rule: RuleChange,
  clock: Clock,
): Promise<void> {
  if (rule === undefined) return
  const existing = await findLinkedRule(db, previousCategoryId)
  if (rule === null) {
    if (existing)
      await db
        .update(rules)
        .set({ deletedAt: nowIso(clock) })
        .where(eq(rules.id, existing.id))
    return
  }
  if (existing)
    await db
      .update(rules)
      .set({ ...rule, categoryId })
      .where(eq(rules.id, existing.id))
  else await db.insert(rules).values({ ...rule, categoryId, markAsTransfer: false, priority: BUDGET_RULE_PRIORITY })
  await categorizeTransactions(db, await loadCategorizableTransactions(db), "uncategorized")
}
