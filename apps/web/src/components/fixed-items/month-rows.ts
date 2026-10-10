import type { PeriodRange } from "@centime/core"
import type { FixedItem, FixedItemOverview, OccurrenceReport } from "@/lib/api"
import { occurrenceIn } from "@/lib/fixed-items"

export type MonthRow = {
  item: FixedItem
  occurrence: OccurrenceReport | undefined
  next: OccurrenceReport | null
}

function byDueDate(left: MonthRow, right: MonthRow): number {
  if (left.occurrence && right.occurrence) return left.occurrence.dueDate.localeCompare(right.occurrence.dueDate)
  return Number(right.occurrence !== undefined) - Number(left.occurrence !== undefined)
}

export function monthRows(items: FixedItem[], overviews: Map<string, FixedItemOverview>, month: PeriodRange): MonthRow[] {
  return items
    .map((item) => {
      const overview = overviews.get(item.id)
      return { item, occurrence: occurrenceIn(overview?.occurrences ?? [], month), next: overview?.nextOccurrence ?? null }
    })
    .sort(byDueDate)
}
