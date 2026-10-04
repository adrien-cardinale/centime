import type { Periodicity, PeriodRange } from "@centime/core"
import type { FixedItem, OccurrenceReport } from "./api"
import { monthLabels, periodicityLabels, quarterMonthLabels } from "./labels"

export const FIXED_ITEM_CURRENCY = "CHF"

const DEVIATION_TOLERANCE_RATIO = 0.01

export type Direction = "expense" | "income"

export function directionOf(amount: number): Direction {
  return amount > 0 ? "income" : "expense"
}

export function signedAmount(direction: Direction, absolute: number): number {
  return direction === "income" ? absolute : -absolute
}

function dueMonthLabel(periodicity: Periodicity, dueMonth: number | null): string | null {
  if (periodicity === "monthly" || dueMonth === null) return null
  const labels: readonly string[] = periodicity === "quarterly" ? quarterMonthLabels : monthLabels
  return labels[dueMonth - 1]?.toLowerCase() ?? null
}

export function dueDescription(item: Pick<FixedItem, "periodicity" | "dueDay" | "dueMonth">): string {
  const day = item.dueDay === null || item.dueDay === 1 ? "le 1er" : `le ${item.dueDay}`
  const month = dueMonthLabel(item.periodicity, item.dueMonth)
  return [periodicityLabels[item.periodicity], month ? `${day}, ${month}` : day].join(" · ")
}

export function isDeviationSmall(report: Pick<OccurrenceReport, "deviation" | "expectedAmount">): boolean {
  if (report.deviation === null) return true
  return Math.abs(report.deviation) < Math.abs(report.expectedAmount) * DEVIATION_TOLERANCE_RATIO
}

export function occurrenceIn(reports: OccurrenceReport[], range: PeriodRange): OccurrenceReport | undefined {
  return reports.find((report) => report.dueDate >= range.start && report.dueDate <= range.end)
}
