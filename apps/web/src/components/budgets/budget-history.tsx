import type { BudgetOverviewItem } from "@/lib/api"
import { BUDGET_CURRENCY } from "@/lib/budgets"
import { formatAmount } from "@/lib/format"
import { cn } from "@/lib/utils"

type BudgetHistoryProps = {
  history: BudgetOverviewItem["history"]
  amount: number
}

function percentOf(value: number, scale: number): string {
  return `${scale > 0 ? (value / scale) * 100 : 0}%`
}

export function BudgetHistory({ history, amount }: BudgetHistoryProps) {
  const scale = Math.max(amount, ...history.map((period) => period.spent))
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">Périodes précédentes</p>
      <div className="relative flex h-12 items-end gap-1">
        <div
          aria-hidden
          className="absolute inset-x-0 border-t border-dashed border-muted-foreground/40"
          style={{ bottom: percentOf(amount, scale) }}
        />
        {history.map((period) => (
          <div
            key={period.range.start}
            title={`${period.range.label} : ${formatAmount(period.spent, BUDGET_CURRENCY)}`}
            className={cn(
              "min-h-px flex-1 rounded-sm",
              period.spent > amount ? "bg-red-500/80 dark:bg-red-400/80" : "bg-zinc-300 dark:bg-zinc-600",
            )}
            style={{ height: percentOf(period.spent, scale) }}
          />
        ))}
      </div>
    </div>
  )
}
