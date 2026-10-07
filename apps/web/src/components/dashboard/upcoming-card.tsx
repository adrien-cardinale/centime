import { useTranslation } from "react-i18next"
import { Amount } from "@/components/amount"
import { OccurrenceStatusBadge } from "@/components/fixed-items/occurrence-status-badge"
import type { UpcomingOccurrence } from "@/lib/api"
import { DASHBOARD_CURRENCY } from "@/lib/dashboard"
import { formatDate } from "@/lib/format"
import { SummaryCard } from "./summary-card"

export function UpcomingCard({ occurrences }: { occurrences: UpcomingOccurrence[] }) {
  const { t } = useTranslation()
  return (
    <SummaryCard
      title={t("dashboardPage.upcoming.title")}
      to="/budgets"
      isEmpty={occurrences.length === 0}
      emptyMessage={t("dashboardPage.upcoming.empty")}
    >
      <ul className="divide-y">
        {occurrences.map((occurrence) => (
          <li
            key={`${occurrence.fixedItemId}-${occurrence.dueDate}`}
            className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1 py-2 text-sm first:pt-0 last:pb-0"
          >
            <span className="text-muted-foreground tabular-nums">{formatDate(occurrence.dueDate)}</span>
            <span className="truncate font-medium">{occurrence.fixedItemName}</span>
            <Amount amount={occurrence.expectedAmount} currency={DASHBOARD_CURRENCY} className="text-right" />
            <OccurrenceStatusBadge status={occurrence.status} className="col-start-2 w-fit" />
          </li>
        ))}
      </ul>
    </SummaryCard>
  )
}
