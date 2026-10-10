import { useTranslation } from "react-i18next"
import { CategoryBadge } from "@/components/categories/category-badge"
import { Progress } from "@/components/ui/progress"
import type { BudgetOverviewItem, Theme } from "@/lib/api"
import { budgetStateIndicatorClasses, budgetStateTextClasses, progressPercent } from "@/lib/budgets"
import { budgetStateLabels } from "@/lib/labels"
import { cn } from "@/lib/utils"
import { BudgetActionsMenu } from "./budget-actions-menu"
import { budgetDetails, groupByTheme, money, type ThemeBudgets } from "./budget-groups"

type BudgetCardListProps = {
  budgets: BudgetOverviewItem[]
  themes: Theme[]
  onEdit: (budget: BudgetOverviewItem) => void
}

export function BudgetCardList({ budgets, themes, onEdit }: BudgetCardListProps) {
  return (
    <div className="divide-y">
      {groupByTheme(budgets, themes).map((group) => (
        <section key={group.theme?.id ?? "none"}>
          <ThemeHeader group={group} />
          <ul className="divide-y">
            {group.budgets.map((budget) => (
              <BudgetCard key={budget.id} budget={budget} onEdit={onEdit} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function ThemeHeader({ group }: { group: ThemeBudgets }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 bg-muted/40 px-4 py-2">
      <h3 className="text-sm font-semibold">{group.theme?.name ?? t("budgets.table.noTheme")}</h3>
      <span className="text-xs text-muted-foreground tabular-nums">
        {money(group.totals.spent)} / {money(group.totals.available)}
      </span>
    </div>
  )
}

function BudgetCard({ budget, onEdit }: { budget: BudgetOverviewItem; onEdit: (budget: BudgetOverviewItem) => void }) {
  const { t } = useTranslation()
  const { status } = budget
  const details = budgetDetails(status)
  return (
    <li className="relative px-4 py-3 has-[>button:hover]:bg-muted/50">
      <button
        type="button"
        onClick={() => onEdit(budget)}
        aria-label={t("budgets.table.edit", { name: budget.categoryName })}
        className="absolute inset-0 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset"
      />
      <div className="pointer-events-none relative flex flex-col gap-2">
        <div className="flex min-h-11 items-center pr-12">
          <CategoryBadge name={budget.categoryName} color={budget.categoryColor} className="max-w-full" />
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm tabular-nums">
          <span>
            {money(status.spent)} / {money(status.available)}
          </span>
          <span className="text-xs text-muted-foreground">{status.range.label}</span>
        </div>
        <Progress
          value={progressPercent(status.ratio)}
          className="bg-muted"
          indicatorClassName={budgetStateIndicatorClasses[status.state]}
        />
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
          <span className={cn("font-medium", budgetStateTextClasses[status.state])}>{budgetStateLabels[status.state]}</span>
          <span className={cn("tabular-nums", status.remaining < 0 && budgetStateTextClasses.exceeded)}>
            {t("budgets.card.remaining", { amount: money(status.remaining) })}
          </span>
        </div>
        {details.length > 0 && <p className="text-sm whitespace-normal text-muted-foreground">{details.join(" · ")}</p>}
      </div>
      <div className="absolute top-3 right-2">
        <BudgetActionsMenu budget={budget} onEdit={onEdit} />
      </div>
    </li>
  )
}
