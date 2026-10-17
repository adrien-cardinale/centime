import { PERIOD_MONTHS, roundCents } from "./calendar"
import type { Budget } from "./types"

export type PlanLine = { expected: number; actual: number }

export type MonthPlan = {
  income: PlanLine
  envelopes: PlanLine
  remaining: number
}

export function monthlyBudgetAmount(budget: Pick<Budget, "amount" | "period">): number {
  return roundCents(budget.amount / PERIOD_MONTHS[budget.period])
}

export function monthPlanOf(income: PlanLine, envelopes: PlanLine): MonthPlan {
  return { income, envelopes, remaining: roundCents(income.expected - envelopes.expected) }
}
