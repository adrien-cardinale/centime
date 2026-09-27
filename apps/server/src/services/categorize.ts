import { applyCompiledRules, type CompiledRule, compileRules, type RuleOutcome, type RuleSubject } from "@centime/core"
import { type DbExecutor, rules, transactions } from "@centime/db"
import { and, inArray, isNull } from "drizzle-orm"

export type Categorizer = (subject: RuleSubject) => RuleOutcome | null
export type FixedItemLinker = (subject: RuleSubject) => string | null

type RuleEngine = { categorize: Categorizer; linkFixedItem: FixedItemLinker }

export type ApplyScope = "uncategorized" | "all"

export type ApplyRulesResult = {
  examined: number
  categorized: number
  markedAsTransfer: number
  linkedToFixedItem: number
}

export type CategorizableTransaction = RuleSubject & {
  id: string
  categoryId: string | null
  fixedItemId: string | null
  isTransfer: boolean
}

type Assignment = Pick<CategorizableTransaction, "categoryId" | "fixedItemId" | "isTransfer">

const UPDATE_CHUNK_SIZE = 500

export async function loadActiveRules(db: DbExecutor) {
  return db
    .select({
      id: rules.id,
      pattern: rules.pattern,
      matchKind: rules.matchKind,
      field: rules.field,
      categoryId: rules.categoryId,
      fixedItemId: rules.fixedItemId,
      markAsTransfer: rules.markAsTransfer,
      priority: rules.priority,
      createdAt: rules.createdAt,
    })
    .from(rules)
    .where(isNull(rules.deletedAt))
}

function fixedItemLinker(compiled: CompiledRule[]): FixedItemLinker {
  const linking = compiled.filter((candidate) => candidate.rule.fixedItemId !== null)
  return (subject) => applyCompiledRules(linking, subject)?.fixedItemId ?? null
}

async function loadRuleEngine(db: DbExecutor): Promise<RuleEngine> {
  const { compiled } = compileRules(await loadActiveRules(db))
  const linkFixedItem = fixedItemLinker(compiled)
  const categorize: Categorizer = (subject) => {
    const winner = applyCompiledRules(compiled, subject)
    if (!winner || winner.fixedItemId !== null) return winner
    return { ...winner, fixedItemId: linkFixedItem(subject) }
  }
  return { categorize, linkFixedItem }
}

export async function loadCategorizer(db: DbExecutor): Promise<Categorizer> {
  return (await loadRuleEngine(db)).categorize
}

export function assignmentFor(current: Assignment, outcome: RuleOutcome | null): Assignment {
  if (!outcome) return current
  return {
    categoryId: outcome.categoryId ?? current.categoryId,
    fixedItemId: outcome.fixedItemId ?? current.fixedItemId,
    isTransfer: outcome.markAsTransfer || current.isTransfer,
  }
}

function isEligible(transaction: CategorizableTransaction, scope: ApplyScope): boolean {
  return scope === "all" || (transaction.categoryId === null && !transaction.isTransfer)
}

function currentAssignment(transaction: CategorizableTransaction): Assignment {
  return { categoryId: transaction.categoryId, fixedItemId: transaction.fixedItemId, isTransfer: transaction.isTransfer }
}

function nextAssignment(transaction: CategorizableTransaction, scope: ApplyScope, engine: RuleEngine): Assignment {
  const current = currentAssignment(transaction)
  if (isEligible(transaction, scope)) return assignmentFor(current, engine.categorize(transaction))
  if (current.fixedItemId !== null) return current
  return { ...current, fixedItemId: engine.linkFixedItem(transaction) }
}

function assignmentKey(assignment: Assignment): string {
  return JSON.stringify([assignment.categoryId, assignment.fixedItemId, assignment.isTransfer])
}

function hasChanged(before: Assignment, after: Assignment): boolean {
  return assignmentKey(before) !== assignmentKey(after)
}

type PlannedChanges = { groups: Map<string, { assignment: Assignment; ids: string[] }>; result: ApplyRulesResult }

function emptyResult(candidates: CategorizableTransaction[], scope: ApplyScope): ApplyRulesResult {
  const examined = candidates.filter((transaction) => isEligible(transaction, scope)).length
  return { examined, categorized: 0, markedAsTransfer: 0, linkedToFixedItem: 0 }
}

function planChanges(candidates: CategorizableTransaction[], scope: ApplyScope, engine: RuleEngine): PlannedChanges {
  const groups: PlannedChanges["groups"] = new Map()
  const result = emptyResult(candidates, scope)
  for (const transaction of candidates) {
    const next = nextAssignment(transaction, scope, engine)
    if (!hasChanged(currentAssignment(transaction), next)) continue
    if (next.categoryId !== null && next.categoryId !== transaction.categoryId) result.categorized++
    if (next.isTransfer && !transaction.isTransfer) result.markedAsTransfer++
    if (next.fixedItemId !== null && transaction.fixedItemId === null) result.linkedToFixedItem++
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
      .where(and(inArray(transactions.id, ids.slice(start, start + UPDATE_CHUNK_SIZE)), isNull(transactions.deletedAt)))
  }
}

export async function categorizeTransactions(
  db: DbExecutor,
  candidates: CategorizableTransaction[],
  scope: ApplyScope,
): Promise<ApplyRulesResult> {
  const { groups, result } = planChanges(candidates, scope, await loadRuleEngine(db))
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
      fixedItemId: transactions.fixedItemId,
      isTransfer: transactions.isTransfer,
    })
    .from(transactions)
    .where(isNull(transactions.deletedAt))
}
