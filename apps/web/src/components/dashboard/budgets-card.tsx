import { CategoryBadge } from "@/components/categories/category-badge"
import { Progress } from "@/components/ui/progress"
import type { BudgetOverviewItem } from "@/lib/api"
import { budgetStateIndicatorClasses, progressPercent } from "@/lib/budgets"
import { money } from "@/lib/dashboard"
import { budgetStateLabels } from "@/lib/labels"
import { SummaryCard } from "./summary-card"

export function BudgetsCard({ budgets }: { budgets: BudgetOverviewItem[] }) {
  return (
    <SummaryCard title="Budgets du mois" to="/budgets" isEmpty={budgets.length === 0} emptyMessage="Aucun budget défini.">
      <ul className="space-y-4">
        {budgets.map((budget) => (
          <li key={budget.id} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <CategoryBadge name={budget.categoryName} color={budget.categoryColor} className="max-w-40" />
              <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                {money(budget.status.spent)} / {money(budget.status.available)}
              </span>
            </div>
            <Progress
              value={progressPercent(budget.status.ratio)}
              className="bg-muted"
              indicatorClassName={budgetStateIndicatorClasses[budget.status.state]}
              aria-label={`${budget.categoryName} : ${budgetStateLabels[budget.status.state]}`}
            />
          </li>
        ))}
      </ul>
    </SummaryCard>
  )
}
