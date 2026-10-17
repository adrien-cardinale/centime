import { applyCompiledRules, compileRules, type RuleOutcome, type RuleSubject } from "@centime/core"
import { type DbExecutor, rules, transactions } from "@centime/db"
import { and, eq, inArray, isNull } from "drizzle-orm"

export type Categorizer = (subject: RuleSubject) => RuleOutcome | null

export type ApplyScope = "uncategorized" | "all"

export type ApplyRulesResult = {
  examined: number
  categorized: number
  markedAsTransfer: number
}

export type CategorizableTransaction = RuleSubject & {
  id: string
  categoryId: string | null
  isTransfer: boolean
}

type Assignment = Pick<CategorizableTransaction, "categoryId" | "isTransfer">

const UPDATE_CHUNK_SIZE = 500

export async function loadActiveRules(db: DbExecutor) {
  return db
    .select({
      id: rules.id,
      pattern: rules.pattern,
      matchKind: rules.matchKind,
      field: rules.field,
      categoryId: rules.categoryId,
      markAsTransfer: rules.markAsTransfer,
      priority: rules.priority,
      createdAt: rules.createdAt,
    })
    .from(rules)
    .where(isNull(rules.deletedAt))
}

export async function loadCategorizer(db: DbExecutor): Promise<Categorizer> {
  const { compiled } = compileRules(await loadActiveRules(db))
  return (subject) => applyCompiledRules(compiled, subject)
}

export function assignmentFor(current: Assignment, outcome: RuleOutcome | null): Assignment {
  if (!outcome) return current
  return {
    categoryId: outcome.categoryId ?? current.categoryId,
    isTransfer: outcome.markAsTransfer || current.isTransfer,
  }
}

function isEligible(transaction: CategorizableTransaction, scope: ApplyScope): boolean {
  return scope === "all" || (transaction.categoryId === null && !transaction.isTransfer)
}

function currentAssignment(transaction: CategorizableTransaction): Assignment {
  return { categoryId: transaction.categoryId, isTransfer: transaction.isTransfer }
}

function assignmentKey(assignment: Assignment): string {
  return JSON.stringify([assignment.categoryId, assignment.isTransfer])
}

function hasChanged(before: Assignment, after: Assignment): boolean {
  return assignmentKey(before) !== assignmentKey(after)
}

type PlannedChanges = { groups: Map<string, { assignment: Assignment; ids: string[] }>; result: ApplyRulesResult }

function emptyResult(candidates: CategorizableTransaction[], scope: ApplyScope): ApplyRulesResult {
  return {
    examined: candidates.filter((transaction) => isEligible(transaction, scope)).length,
    categorized: 0,
    markedAsTransfer: 0,
  }
}

function planChanges(
  candidates: CategorizableTransaction[],
  scope: ApplyScope,
  categorize: Categorizer,
): PlannedChanges {
  const groups: PlannedChanges["groups"] = new Map()
  const result = emptyResult(candidates, scope)
  for (const transaction of candidates.filter((candidate) => isEligible(candidate, scope))) {
    const next = assignmentFor(currentAssignment(transaction), categorize(transaction))
    if (!hasChanged(currentAssignment(transaction), next)) continue
    if (next.categoryId !== null && next.categoryId !== transaction.categoryId) result.categorized++
    if (next.isTransfer && !transaction.isTransfer) result.markedAsTransfer++
    const key = assignmentKey(next)
    const group = groups.get(key) ?? { assignment: next, ids: [] }
    group.ids.push(transaction.id)
    groups.set(key, group)
  }
  return { groups, result }
}

async function writeAssignment(db: DbExecutor, assignment: Assignment, ids: string[]): Promise<void> {
  for (let start = 0; start < ids.length; start += UPDATE_CHUNK_SIZE) {
    await db
      .update(transactions)
      .set(assignment)
      .where(
        and(
          inArray(transactions.id, ids.slice(start, start + UPDATE_CHUNK_SIZE)),
          isNull(transactions.deletedAt),
          eq(transactions.isSplit, false),
        ),
      )
  }
}

export async function categorizeTransactions(
  db: DbExecutor,
  candidates: CategorizableTransaction[],
  scope: ApplyScope,
): Promise<ApplyRulesResult> {
  const { groups, result } = planChanges(candidates, scope, await loadCategorizer(db))
  for (const { assignment, ids } of groups.values()) await writeAssignment(db, assignment, ids)
  return result
}

export async function loadCategorizableTransactions(db: DbExecutor): Promise<CategorizableTransaction[]> {
  return db
    .select({
      id: transactions.id,
      rawLabel: transactions.rawLabel,
      merchant: transactions.merchant,
      providerCategory: transactions.providerCategory,
      categoryId: transactions.categoryId,
      isTransfer: transactions.isTransfer,
    })
    .from(transactions)
    .where(and(isNull(transactions.deletedAt), eq(transactions.isSplit, false)))
}
