import { useTranslation } from "react-i18next"
import { CategoryBadge } from "@/components/categories/category-badge"
import { Progress } from "@/components/ui/progress"
import type { BudgetOverviewItem } from "@/lib/api"
import { budgetStateIndicatorClasses, progressPercent } from "@/lib/budgets"
import { money } from "@/lib/dashboard"
import { budgetStateLabels } from "@/lib/labels"
import { SummaryCard } from "./summary-card"

export function BudgetsCard({ budgets }: { budgets: BudgetOverviewItem[] }) {
  const { t } = useTranslation()
  return (
    <SummaryCard title={t("dashboardPage.budgets.title")}
      to="/budgets"
      isEmpty={budgets.length === 0}
      emptyMessage={t("dashboardPage.budgets.empty")}>
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
