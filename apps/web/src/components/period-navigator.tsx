import { periodContaining, shiftMonths } from "@centime/core"
import { useTranslation } from "react-i18next"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { todayIso } from "@/lib/budgets"
import { cn } from "@/lib/utils"

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
    <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:justify-start">
      <div className="flex items-center gap-1 sm:gap-2">
        <Button variant="outline" size="icon" aria-label={t("periodNavigator.previous")} onClick={() => onChange(shiftMonths(date, -1))}>
          <ChevronLeft />
        </Button>
        <span aria-live="polite" className="min-w-28 text-center text-sm font-medium sm:min-w-36 sm:text-base">{month.label}</span>
        <Button variant="outline" size="icon" aria-label={t("periodNavigator.next")} onClick={() => onChange(shiftMonths(date, 1))}>
          <ChevronRight />
        </Button>
      </div>
      <Button
        variant="ghost"
        size="sm"
        disabled={isCurrentMonth}
        className={cn(isCurrentMonth && "invisible")}
        onClick={() => onChange(today)}
      >
        {t("periodNavigator.today")}
      </Button>
    </div>
  )
}
