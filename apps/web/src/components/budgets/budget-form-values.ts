import type { Budget, BudgetPayloadInput, RuleMatcherInput } from "@centime/core"
import { monthBoundaryOf } from "@/components/ui/month-picker"
import { defaultStartDate } from "@/lib/budgets"

export type BudgetFormValues = BudgetPayloadInput

export type EditableBudget = Pick<
  Budget,
  "id" | "kind" | "categoryId" | "amount" | "period" | "rollover" | "startDate" | "endDate"
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
    const { id: _id, rule, startDate, endDate, ...values } = budget
    return {
      ...values,
      startDate: monthBoundaryOf(startDate, "start"),
      endDate: endDate && monthBoundaryOf(endDate, "end"),
      rule: toMatcher(rule),
    }
  }
  return {
    kind: "envelope",
    categoryId: categoryId ?? "",
    amount: 0,
    period: "monthly",
    rollover: false,
    startDate: defaultStartDate("monthly"),
    endDate: null,
    rule: null,
  }
}
