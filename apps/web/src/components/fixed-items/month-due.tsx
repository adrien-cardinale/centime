import { useTranslation } from "react-i18next"
import { formatDate } from "@/lib/format"
import type { MonthRow } from "./month-rows"
import { OccurrenceStatusBadge } from "./occurrence-status-badge"

export function MonthDue({ row }: { row: MonthRow }) {
  const { t } = useTranslation()
  const { occurrence, next } = row
  if (occurrence) {
    return (
      <span className="flex items-center gap-2">
        <span className="tabular-nums">{formatDate(occurrence.dueDate)}</span>
        <OccurrenceStatusBadge status={occurrence.status} />
      </span>
    )
  }
  return (
    <span className="text-muted-foreground">
      {next ? t("fixedItemsUi.table.next", { date: formatDate(next.dueDate) }) : t("fixedItemsUi.table.noDue")}
    </span>
  )
}
