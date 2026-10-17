import type { Budget, BudgetPayloadInput, RuleMatcherInput } from "@centime/core"
import { defaultStartDate } from "@/lib/budgets"

export type BudgetFormValues = BudgetPayloadInput

export type EditableBudget = Pick<
  Budget,
  "id" | "kind" | "categoryId" | "amount" | "period" | "rollover" | "startDate"
> & {
  rule: RuleMatcherInput | null
}

export type BudgetDialogTarget = { budget?: EditableBudget; categoryId?: string }

export function emptyRule(pattern: string): RuleMatcherInput {
  return { pattern, matchKind: "contains", field: "raw_label" }
}

function toMatcher(rule: RuleMatcherInput | null): RuleMatcherInput | null {
  return rule ? { pattern: rule.pattern, matchKind: rule.matchKind, field: rule.field } : null
}

export function formValuesFor({ budget, categoryId }: BudgetDialogTarget): BudgetFormValues {
  if (budget) {
    const { id: _id, rule, ...values } = budget
    return { ...values, rule: toMatcher(rule) }
  }
  return {
    kind: "envelope",
    categoryId: categoryId ?? "",
    amount: 0,
    period: "monthly",
    rollover: false,
    startDate: defaultStartDate("monthly"),
    rule: null,
  }
}
