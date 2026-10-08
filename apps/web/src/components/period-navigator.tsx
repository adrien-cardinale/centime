import { periodContaining, shiftMonths } from "@centime/core"
import { useTranslation } from "react-i18next"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { todayIso } from "@/lib/budgets"

type PeriodNavigatorProps = {
  date: string
  onChange: (date: string) => void
}

export function PeriodNavigator({ date, onChange }: PeriodNavigatorProps) {
  const { t } = useTranslation()
  const month = periodContaining("monthly", date)
  const today = todayIso()
  const isCurrentMonth = today >= month.start && today <= month.end
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="icon" className="size-10 sm:size-9" aria-label={t("periodNavigator.previous")} onClick={() => onChange(shiftMonths(date, -1))}>
        <ChevronLeft />
      </Button>
      <span aria-live="polite" className="min-w-36 text-center font-medium">{month.label}</span>
      <Button variant="outline" size="icon" className="size-10 sm:size-9" aria-label={t("periodNavigator.next")} onClick={() => onChange(shiftMonths(date, 1))}>
        <ChevronRight />
      </Button>
      {!isCurrentMonth && (
        <Button variant="ghost" size="sm" onClick={() => onChange(today)}>
          {t("periodNavigator.today")}
        </Button>
      )}
    </div>
  )
}
