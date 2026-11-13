import { useTranslation } from "react-i18next"
import { CategoryBadge } from "@/components/categories/category-badge"
import { Progress } from "@/components/ui/progress"
import type { BudgetOverviewItem } from "@/lib/api"
import { useMoney } from "@/lib/base-currency"
import { budgetStateIndicatorClasses, progressPercent } from "@/lib/budgets"
import { budgetStateLabels } from "@/lib/labels"
import { SummaryCard } from "./summary-card"

export function BudgetsCard({ budgets }: { budgets: BudgetOverviewItem[] }) {
  const { t } = useTranslation()
  const { money } = useMoney()
  return (
    <SummaryCard
      title={t("dashboardPage.budgets.title")}
      to="/budgets"
      isEmpty={budgets.length === 0}
      emptyMessage={t("dashboardPage.budgets.empty")}
    >
      <ul className="space-y-4">
        {budgets.map((budget) => (
          <li key={budget.id} className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
              <CategoryBadge
                name={budget.categoryName}
                color={budget.categoryColor}
                className="max-w-full sm:max-w-40"
              />
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
