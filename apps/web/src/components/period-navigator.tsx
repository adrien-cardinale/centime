import { periodContaining, shiftMonths } from "@centime/core"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { todayIso } from "@/lib/budgets"

type PeriodNavigatorProps = {
  date: string
  onChange: (date: string) => void
}

export function PeriodNavigator({ date, onChange }: PeriodNavigatorProps) {
  const month = periodContaining("monthly", date)
  const today = todayIso()
  const isCurrentMonth = today >= month.start && today <= month.end
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="icon" aria-label="Mois précédent" onClick={() => onChange(shiftMonths(date, -1))}>
        <ChevronLeft />
      </Button>
      <span className="min-w-36 text-center font-medium">{month.label}</span>
      <Button variant="outline" size="icon" aria-label="Mois suivant" onClick={() => onChange(shiftMonths(date, 1))}>
        <ChevronRight />
      </Button>
      {!isCurrentMonth && (
        <Button variant="ghost" size="sm" onClick={() => onChange(today)}>
          Aujourd'hui
        </Button>
      )}
    </div>
  )
}
