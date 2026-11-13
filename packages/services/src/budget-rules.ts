import type { RuleMatcherInput } from "@centime/core"
import { type DbExecutor, rules } from "@centime/db"
import { and, asc, eq, isNotNull, isNull } from "drizzle-orm"
import { categorizeTransactions, loadCategorizableTransactions } from "./categorize"
import { type Clock, nowIso } from "./clock"

const BUDGET_RULE_PRIORITY = 60

export type LinkedRule = RuleMatcherInput & { id: string }

type RuleChange = RuleMatcherInput | null | undefined

function ownedRuleCondition(budgetId: string) {
  return and(eq(rules.budgetId, budgetId), isNull(rules.deletedAt))
}

export async function loadLinkedRules(db: DbExecutor): Promise<Map<string, LinkedRule>> {
  const rows = await db
    .select({
      id: rules.id,
      budgetId: rules.budgetId,
      pattern: rules.pattern,
      matchKind: rules.matchKind,
      field: rules.field,
    })
    .from(rules)
    .where(and(isNotNull(rules.budgetId), isNull(rules.deletedAt)))
    .orderBy(asc(rules.createdAt))
  const byBudget = new Map<string, LinkedRule>()
  for (const { budgetId, ...rule } of rows) {
    if (budgetId !== null && !byBudget.has(budgetId)) byBudget.set(budgetId, rule)
  }
  return byBudget
}

async function findOwnedRule(db: DbExecutor, budgetId: string) {
  const [existing] = await db
    .select({ id: rules.id })
    .from(rules)
    .where(ownedRuleCondition(budgetId))
    .orderBy(asc(rules.createdAt))
    .limit(1)
  return existing
}

export async function syncLinkedRule(
  db: DbExecutor,
  budgetId: string,
  categoryId: string,
  rule: RuleChange,
  clock: Clock,
): Promise<void> {
  if (rule === undefined) return
  const existing = await findOwnedRule(db, budgetId)
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
  else
    await db
      .insert(rules)
      .values({ ...rule, categoryId, budgetId, markAsTransfer: false, priority: BUDGET_RULE_PRIORITY })
  await categorizeTransactions(db, await loadCategorizableTransactions(db), "uncategorized")
}
