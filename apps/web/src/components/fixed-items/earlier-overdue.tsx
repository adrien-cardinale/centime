import type { PeriodRange } from "@centime/core"
import { CircleAlert } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import type { FixedItemOverview } from "@/lib/api"

type EarlierOverdueProps = {
  overviews: FixedItemOverview[]
  month: PeriodRange
  onSelect: (date: string) => void
}

export function EarlierOverdue({ overviews, month, onSelect }: EarlierOverdueProps) {
  const { t } = useTranslation()
  const dueDates = overviews
    .flatMap((overview) => overview.occurrences)
    .filter((report) => report.status === "overdue" && report.dueDate < month.start)
    .map((report) => report.dueDate)
    .sort()
  const [oldest] = dueDates
  if (oldest === undefined) return null
  return (
    <Button
      variant="link"
      size="sm"
      onClick={() => onSelect(oldest)}
      className="h-auto gap-1.5 p-0 text-muted-foreground hover:text-foreground"
    >
      <CircleAlert className="size-3.5" aria-hidden />
      {t("fixedItemsUi.earlierOverdue", { count: dueDates.length })}
    </Button>
  )
}
