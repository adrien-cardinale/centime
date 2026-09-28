import { addDays, addMonths, differenceInCalendarDays, format, lastDayOfMonth, parseISO, setDate, startOfMonth } from "date-fns"
import type { FixedItem, IsoDate, Periodicity } from "./types"

export type FixedItemInput = Pick<
  FixedItem,
  "id" | "name" | "expectedAmount" | "periodicity" | "dueDay" | "dueMonth" | "startDate" | "endDate"
>

export type OccurrenceStatus = "paid" | "upcoming" | "due" | "overdue"

export const OCCURRENCE_STATUSES = ["paid", "upcoming", "due", "overdue"] as const satisfies readonly OccurrenceStatus[]

export type Occurrence = {
  fixedItemId: string
  expectedAmount: number
  dueDate: IsoDate
  windowStart: IsoDate
  windowEnd: IsoDate
}

export type MatchedTransaction = {
  id: string
  bookingDate: IsoDate
  amount: number
  rawLabel: string
}

export type OccurrenceReport = Occurrence & {
  status: OccurrenceStatus
  transactions: MatchedTransaction[]
  actualAmount: number | null
  deviation: number | null
}

export type FixedItemSummary = {
  expectedTotal: number
  actualTotal: number
  paidCount: number
  missedCount: number
}

export type DateRange = { from: IsoDate; to: IsoDate }

export const PERIOD_MONTHS: Record<Periodicity, number> = { monthly: 1, quarterly: 3, yearly: 12 }
const MATCH_TOLERANCE_DAYS: Record<Periodicity, number> = { monthly: 10, quarterly: 20, yearly: 30 }
const NEXT_OCCURRENCE_HORIZON_MONTHS = 13
const ISO_FORMAT = "yyyy-MM-dd"

function toIso(date: Date): IsoDate {
  return format(date, ISO_FORMAT)
}

export function shiftDays(date: IsoDate, days: number): IsoDate {
  return toIso(addDays(parseISO(date), days))
}

export function shiftMonths(date: IsoDate, months: number): IsoDate {
  return toIso(addMonths(parseISO(date), months))
}

export function roundCents(amount: number): number {
  return Math.round(amount * 100) / 100
}

export function monthlyEquivalent(item: Pick<FixedItemInput, "expectedAmount" | "periodicity">): number {
  return roundCents(item.expectedAmount / PERIOD_MONTHS[item.periodicity])
}

function isDueMonth(item: FixedItemInput, monthIndex: number): boolean {
  const period = PERIOD_MONTHS[item.periodicity]
  const dueMonth = item.dueMonth ?? 1
  return monthIndex % period === (dueMonth - 1) % period
}

function dueDateIn(monthStart: Date, dueDay: number | null): Date {
  const day = Math.min(dueDay ?? 1, lastDayOfMonth(monthStart).getDate())
  return setDate(monthStart, day)
}

function toOccurrence(item: FixedItemInput, dueDate: Date): Occurrence {
  const tolerance = MATCH_TOLERANCE_DAYS[item.periodicity]
  return {
    fixedItemId: item.id,
    expectedAmount: item.expectedAmount,
    dueDate: toIso(dueDate),
    windowStart: toIso(addDays(dueDate, -tolerance)),
    windowEnd: toIso(addDays(dueDate, tolerance)),
  }
}

function laterOf(left: IsoDate, right: IsoDate): IsoDate {
  return left > right ? left : right
}

function earlierOf(left: IsoDate, right: IsoDate | null): IsoDate {
  return right !== null && right < left ? right : left
}

export function occurrencesBetween(item: FixedItemInput, from: IsoDate, to: IsoDate): Occurrence[] {
  const lower = laterOf(from, item.startDate)
  const upper = earlierOf(to, item.endDate)
  const occurrences: Occurrence[] = []
  for (let month = startOfMonth(parseISO(lower)); toIso(month) <= upper; month = addMonths(month, 1)) {
    if (!isDueMonth(item, month.getMonth())) continue
    const dueDate = dueDateIn(month, item.dueDay)
    const iso = toIso(dueDate)
    if (iso >= lower && iso <= upper) occurrences.push(toOccurrence(item, dueDate))
  }
  return occurrences
}

export function nextOccurrence(item: FixedItemInput, today: IsoDate): Occurrence | null {
  const from = laterOf(today, item.startDate)
  return occurrencesBetween(item, from, shiftMonths(from, NEXT_OCCURRENCE_HORIZON_MONTHS))[0] ?? null
}

function distanceToDue(occurrence: Occurrence, date: IsoDate): number {
  return Math.abs(differenceInCalendarDays(parseISO(date), parseISO(occurrence.dueDate)))
}

function isInWindow(occurrence: Occurrence, date: IsoDate): boolean {
  return date >= occurrence.windowStart && date <= occurrence.windowEnd
}

function closestOccurrenceIndex(occurrences: Occurrence[], date: IsoDate): number {
  const windowIndex = occurrences.findIndex((occurrence) => isInWindow(occurrence, date))
  if (windowIndex !== -1) return windowIndex
  let best = -1
  for (const [index, occurrence] of occurrences.entries()) {
    const current = occurrences[best]
    if (current === undefined || distanceToDue(occurrence, date) < distanceToDue(current, date)) best = index
  }
  return best
}

function statusFor(occurrence: Occurrence, isPaid: boolean, today: IsoDate): OccurrenceStatus {
  if (isPaid) return "paid"
  if (today < occurrence.windowStart) return "upcoming"
  if (today > occurrence.windowEnd) return "overdue"
  return "due"
}

function toReport(occurrence: Occurrence, transactions: MatchedTransaction[], today: IsoDate): OccurrenceReport {
  const sorted = [...transactions].sort((left, right) => left.bookingDate.localeCompare(right.bookingDate))
  const actualAmount = sorted.length === 0 ? null : roundCents(sorted.reduce((sum, { amount }) => sum + amount, 0))
  return {
    ...occurrence,
    status: statusFor(occurrence, sorted.length > 0, today),
    transactions: sorted,
    actualAmount,
    deviation: actualAmount === null ? null : roundCents(actualAmount - occurrence.expectedAmount),
  }
}

function uniqueById(transactions: MatchedTransaction[]): MatchedTransaction[] {
  return [...new Map(transactions.map((transaction) => [transaction.id, transaction])).values()]
}

export function matchOccurrences(
  occurrences: Occurrence[],
  transactions: MatchedTransaction[],
  today: IsoDate,
): OccurrenceReport[] {
  const assigned = occurrences.map((): MatchedTransaction[] => [])
  for (const transaction of uniqueById(transactions)) {
    assigned[closestOccurrenceIndex(occurrences, transaction.bookingDate)]?.push(transaction)
  }
  return occurrences.map((occurrence, index) => toReport(occurrence, assigned[index] ?? [], today))
}

export function reportOccurrences(
  item: FixedItemInput,
  transactions: MatchedTransaction[],
  range: DateRange,
  today: IsoDate,
): OccurrenceReport[] {
  const period = PERIOD_MONTHS[item.periodicity]
  const occurrences = occurrencesBetween(item, shiftMonths(range.from, -period), shiftMonths(range.to, period))
  return matchOccurrences(occurrences, transactions, today).filter(
    (report) => report.dueDate >= range.from && report.dueDate <= range.to,
  )
}

function isSettled(report: OccurrenceReport): boolean {
  return report.status === "paid" || report.status === "overdue"
}

export function summarizeItem(reports: OccurrenceReport[]): FixedItemSummary {
  const settled = reports.filter(isSettled)
  return {
    expectedTotal: roundCents(settled.reduce((sum, report) => sum + report.expectedAmount, 0)),
    actualTotal: roundCents(settled.reduce((sum, report) => sum + (report.actualAmount ?? 0), 0)),
    paidCount: settled.filter((report) => report.status === "paid").length,
    missedCount: settled.filter((report) => report.status === "overdue").length,
  }
}

export function defaultOverviewRange(today: IsoDate): DateRange {
  const monthStart = startOfMonth(parseISO(today))
  return { from: toIso(addMonths(monthStart, -2)), to: toIso(lastDayOfMonth(addMonths(monthStart, 3))) }
}

export function isoDateOf(date: Date): IsoDate {
  return toIso(date)
}
