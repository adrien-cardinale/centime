import { type BudgetState, isoDateOf, isoDateSchema, type Periodicity, periodContaining } from "@centime/core"

export const BUDGET_CURRENCY = "CHF"

export const budgetStateIndicatorClasses: Record<BudgetState, string> = {
  ok: "bg-zinc-700 dark:bg-zinc-300",
  warning: "bg-amber-500 dark:bg-amber-400",
  exceeded: "bg-red-600 dark:bg-red-500",
}

export const budgetStateTextClasses: Record<BudgetState, string> = {
  ok: "text-muted-foreground",
  warning: "text-amber-600 dark:text-amber-400",
  exceeded: "text-red-600 dark:text-red-400",
}

export function todayIso(): string {
  return isoDateOf(new Date())
}

export function isIsoDate(value: unknown): value is string {
  return isoDateSchema.safeParse(value).success
}

export function defaultStartDate(period: Periodicity): string {
  return periodContaining(period, todayIso()).start
}

export function progressPercent(ratio: number): number {
  return Math.min(100, Math.max(0, ratio * 100))
}
