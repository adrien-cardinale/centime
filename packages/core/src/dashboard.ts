import { type PeriodRange, shiftPeriod } from "./budgets"
import { roundCents } from "./fixed-items"
import type { IsoDate } from "./types"

export type BreakdownKind = "category" | "other" | "uncategorized"

export type BreakdownEntry = {
  categoryId: string | null
  name: string
  color: string | null
  amount: number
  kind: BreakdownKind
}

export type BalancePoint = { accountId: string; bookingDate: IsoDate; balance: number }

export type MonthBalance = { range: PeriodRange; balance: number }

export const OTHER_CATEGORIES_LABEL = "Autres"
export const UNCATEGORIZED_LABEL = "Non catégorisées"
export const BREAKDOWN_VISIBLE_ENTRIES = 7

export function lastMonths(reference: PeriodRange, count: number): PeriodRange[] {
  return Array.from({ length: count }, (_, index) => shiftPeriod("monthly", reference, index - count + 1))
}

function otherEntry(rest: BreakdownEntry[]): BreakdownEntry[] {
  const amount = roundCents(rest.reduce((sum, entry) => sum + entry.amount, 0))
  if (amount <= 0) return []
  return [{ categoryId: null, name: OTHER_CATEGORIES_LABEL, color: null, amount, kind: "other" }]
}

export function limitBreakdown(entries: readonly BreakdownEntry[], visible = BREAKDOWN_VISIBLE_ENTRIES): BreakdownEntry[] {
  const sorted = entries.filter((entry) => entry.amount > 0).sort((left, right) => right.amount - left.amount)
  return [...sorted.slice(0, visible), ...otherEntry(sorted.slice(visible))]
}

function sumLatestBalances(chronologicalPoints: readonly BalancePoint[]): number | null {
  const latestByAccount = new Map(chronologicalPoints.map((point) => [point.accountId, point.balance]))
  if (latestByAccount.size === 0) return null
  return roundCents([...latestByAccount.values()].reduce((sum, balance) => sum + balance, 0))
}

export function balanceSeries(chronologicalPoints: readonly BalancePoint[], months: readonly PeriodRange[]): MonthBalance[] {
  return months.flatMap((range) => {
    const balance = sumLatestBalances(chronologicalPoints.filter((point) => point.bookingDate <= range.end))
    return balance === null ? [] : [{ range, balance }]
  })
}

export function latestBalance(chronologicalPoints: readonly BalancePoint[]): number | null {
  return sumLatestBalances(chronologicalPoints)
}
