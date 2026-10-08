import {
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  endOfQuarter,
  endOfYear,
  format,
  getQuarter,
  type Locale,
  parseISO,
  startOfMonth,
  startOfQuarter,
  startOfYear,
} from "date-fns"
import { fr } from "date-fns/locale/fr"
import { isoDateOf, PERIOD_MONTHS, roundCents } from "./fixed-items"
import type { Budget, IsoDate, Periodicity } from "./types"

export type PeriodRange = { start: IsoDate; end: IsoDate; label: string }

export type BudgetInput = Pick<Budget, "id" | "amount" | "period" | "rollover" | "startDate">

export type PeriodSpending = { range: PeriodRange; spent: number; pending: number }

export type BudgetState = "ok" | "warning" | "exceeded"

export const BUDGET_STATES = ["ok", "warning", "exceeded"] as const satisfies readonly BudgetState[]

export type BudgetStatus = {
  range: PeriodRange
  amount: number
  carry: number
  available: number
  spent: number
  pending: number
  remaining: number
  ratio: number
  state: BudgetState
  projected: number | null
}

export const MAX_ROLLOVER_PERIODS = 12
const WARNING_RATIO = 0.8

const PERIOD_BOUNDS: Record<Periodicity, { start: (date: Date) => Date; end: (date: Date) => Date }> = {
  monthly: { start: startOfMonth, end: endOfMonth },
  quarterly: { start: startOfQuarter, end: endOfQuarter },
  yearly: { start: startOfYear, end: endOfYear },
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

// Les libellés de période sont calculés hors de React : l'UI fixe la locale au changement de langue.
let periodLocale: Locale = fr

export function setPeriodLocale(locale: Locale): void {
  periodLocale = locale
}

// L'abréviation date-fns du trimestre en français (« 3ème trim. ») est trop longue : on garde « T3 ».
function quarterOf(start: Date): string {
  if (periodLocale.code.startsWith("fr")) return `T${getQuarter(start)}`
  return format(start, "QQQ", { locale: periodLocale })
}

function periodLabel(period: Periodicity, start: Date): string {
  if (period === "monthly") return capitalize(format(start, "LLLL yyyy", { locale: periodLocale }))
  if (period === "quarterly") return `${quarterOf(start)} ${format(start, "yyyy")}`
  return format(start, "yyyy")
}

export function periodContaining(period: Periodicity, date: IsoDate): PeriodRange {
  const bounds = PERIOD_BOUNDS[period]
  const start = bounds.start(parseISO(date))
  return { start: isoDateOf(start), end: isoDateOf(bounds.end(start)), label: periodLabel(period, start) }
}

export function shiftPeriod(period: Periodicity, range: PeriodRange, offset: number): PeriodRange {
  return periodContaining(period, isoDateOf(addMonths(parseISO(range.start), offset * PERIOD_MONTHS[period])))
}

export function previousPeriods(period: Periodicity, range: PeriodRange, count: number): PeriodRange[] {
  return Array.from({ length: count }, (_, index) => shiftPeriod(period, range, index - count))
}

export function budgetRatioOf(spent: number, available: number): number {
  if (available > 0) return spent / available
  return spent > 0 ? 1 : 0
}

export function budgetStateOf(spent: number, available: number): BudgetState {
  if (spent > available) return "exceeded"
  return budgetRatioOf(spent, available) >= WARNING_RATIO ? "warning" : "ok"
}

function carryOf(budget: BudgetInput, current: PeriodRange, previous: PeriodSpending[]): number {
  if (!budget.rollover) return 0
  const counted = previous
    .filter(({ range }) => range.end >= budget.startDate && range.end < current.start)
    .sort((left, right) => left.range.start.localeCompare(right.range.start))
    .slice(-MAX_ROLLOVER_PERIODS)
  return roundCents(counted.reduce((sum, { spent }) => sum + budget.amount - spent, 0))
}

function daysBetween(start: IsoDate, end: IsoDate): number {
  return differenceInCalendarDays(parseISO(end), parseISO(start)) + 1
}

function projectionOf(spent: number, range: PeriodRange, today: IsoDate): number | null {
  if (today < range.start || today > range.end) return null
  return roundCents((spent / daysBetween(range.start, today)) * daysBetween(range.start, range.end))
}

export function computeBudgetStatus(
  budget: BudgetInput,
  current: PeriodSpending,
  previous: PeriodSpending[],
  today: IsoDate,
): BudgetStatus {
  const carry = carryOf(budget, current.range, previous)
  const available = roundCents(budget.amount + carry)
  return {
    range: current.range,
    amount: budget.amount,
    carry,
    available,
    spent: current.spent,
    pending: current.pending,
    remaining: roundCents(available - current.spent),
    ratio: budgetRatioOf(current.spent, available),
    state: budgetStateOf(current.spent, available),
    projected: projectionOf(current.spent, current.range, today),
  }
}
