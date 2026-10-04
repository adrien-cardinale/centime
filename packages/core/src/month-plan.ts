import { type OccurrenceReport, PERIOD_MONTHS, roundCents } from "./fixed-items"
import type { Budget } from "./types"

export type PlanLine = { expected: number; actual: number }

export type MonthPlan = {
  income: PlanLine
  fixedExpenses: PlanLine
  envelopes: PlanLine
  remaining: number
}

type PlannedOccurrence = Pick<OccurrenceReport, "expectedAmount" | "actualAmount">

export function monthlyBudgetAmount(budget: Pick<Budget, "amount" | "period">): number {
  return roundCents(budget.amount / PERIOD_MONTHS[budget.period])
}

function lineOf(occurrences: PlannedOccurrence[], sign: 1 | -1): PlanLine {
  return {
    expected: roundCents(sign * occurrences.reduce((sum, occurrence) => sum + occurrence.expectedAmount, 0)),
    actual: roundCents(sign * occurrences.reduce((sum, occurrence) => sum + (occurrence.actualAmount ?? 0), 0)),
  }
}

export function monthPlanOf(occurrences: PlannedOccurrence[], envelopes: PlanLine): MonthPlan {
  const income = lineOf(
    occurrences.filter((occurrence) => occurrence.expectedAmount > 0),
    1,
  )
  const fixedExpenses = lineOf(
    occurrences.filter((occurrence) => occurrence.expectedAmount <= 0),
    -1,
  )
  return {
    income,
    fixedExpenses,
    envelopes,
    remaining: roundCents(income.expected - fixedExpenses.expected - envelopes.expected),
  }
}
