import { type RulePayload, ruleMatches, type RuleSubject, suggestRulePattern } from "@centime/core"
import { type Db, type DbExecutor, type RuleRow, transactions } from "@centime/db"
import { and, eq, inArray, isNull } from "drizzle-orm"
import { z } from "zod"
import {
  type CategorizableTransaction,
  type Categorizer,
  loadCategorizableTransactions,
  loadCategorizer,
} from "./categorize"
import { createRule } from "./rules"

export const AUTO_RULE_THRESHOLD = 3

const MAX_AUTO_RULE_IDS = 500

export const autoRuleInputSchema = z.object({
  ids: z
    .array(z.string().min(1))
    .min(1, "Sélectionnez au moins une transaction")
    .max(MAX_AUTO_RULE_IDS, `${MAX_AUTO_RULE_IDS} transactions au maximum`),
})

export type AutoRuleInput = z.infer<typeof autoRuleInputSchema>

export type AutoRuleResult = { created: RuleRow[] }

type CategorizedSubject = RuleSubject & { categoryId: string }

type AutoRuleContext = {
  categorize: Categorizer
  candidates: CategorizableTransaction[]
  created: RuleRow[]
}

function candidateRule(subject: CategorizedSubject): RulePayload | null {
  const { field, pattern } = suggestRulePattern(subject)
  if (pattern === "") return null
  return { pattern, matchKind: "contains", field, categoryId: subject.categoryId, markAsTransfer: false, priority: 0 }
}

function isCoveredByExistingRule(context: AutoRuleContext, subject: RuleSubject): boolean {
  return context.categorize(subject) !== null || context.created.some((rule) => ruleMatches(rule, subject))
}

function isConsistentRepetition(candidate: RulePayload, candidates: CategorizableTransaction[]): boolean {
  const rule = { ...candidate, id: "candidate" }
  const matching = candidates.filter((transaction) => ruleMatches(rule, transaction))
  const sameCategory = matching.filter((transaction) => transaction.categoryId === candidate.categoryId)
  const otherCategory = matching.some(
    (transaction) => transaction.categoryId !== null && transaction.categoryId !== candidate.categoryId,
  )
  return sameCategory.length >= AUTO_RULE_THRESHOLD && !otherCategory
}

async function loadCategorizedSubjects(db: DbExecutor, ids: string[]): Promise<CategorizedSubject[]> {
  const rows = await db
    .select({
      rawLabel: transactions.rawLabel,
      merchant: transactions.merchant,
      providerCategory: transactions.providerCategory,
      categoryId: transactions.categoryId,
    })
    .from(transactions)
    .where(and(inArray(transactions.id, ids), isNull(transactions.deletedAt), eq(transactions.isSplit, false)))
  return rows.filter((row): row is CategorizedSubject => row.categoryId !== null)
}

async function createRuleIfRepeated(db: DbExecutor, context: AutoRuleContext, subject: CategorizedSubject) {
  if (isCoveredByExistingRule(context, subject)) return
  const candidate = candidateRule(subject)
  if (!candidate || !isConsistentRepetition(candidate, context.candidates)) return
  context.created.push(await createRule(db, candidate))
}

export function createRulesFromRepeatedCategorization(db: Db, { ids }: AutoRuleInput): Promise<AutoRuleResult> {
  return db.transaction(async (tx) => {
    const context: AutoRuleContext = {
      categorize: await loadCategorizer(tx),
      candidates: await loadCategorizableTransactions(tx),
      created: [],
    }
    for (const subject of await loadCategorizedSubjects(tx, [...new Set(ids)])) {
      await createRuleIfRepeated(tx, context, subject)
    }
    return { created: context.created }
  })
}
