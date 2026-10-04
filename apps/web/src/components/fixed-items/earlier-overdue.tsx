import type { PeriodRange } from "@centime/core"
import { CircleAlert } from "lucide-react"
import type { FixedItemOverview } from "@/lib/api"
import { plural } from "@/lib/dashboard"

type EarlierOverdueProps = {
  overviews: FixedItemOverview[]
  month: PeriodRange
  onSelect: (date: string) => void
}

export function EarlierOverdue({ overviews, month, onSelect }: EarlierOverdueProps) {
  const dueDates = overviews
    .flatMap((overview) => overview.occurrences)
    .filter((report) => report.status === "overdue" && report.dueDate < month.start)
    .map((report) => report.dueDate)
    .sort()
  const [oldest] = dueDates
  if (oldest === undefined) return null
  return (
    <button
      type="button"
      onClick={() => onSelect(oldest)}
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
    >
      <CircleAlert className="size-3.5" aria-hidden />
      {plural(dueDates.length, "échéance en retard", "échéances en retard")} sur les mois précédents
    </button>
  )
}
