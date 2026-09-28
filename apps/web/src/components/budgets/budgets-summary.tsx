import { budgetRatioOf, budgetStateOf, PERIODICITIES, type Periodicity } from "@centime/core"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import type { BudgetOverviewItem, BudgetsOverview, BudgetTotals } from "@/lib/api"
import { BUDGET_CURRENCY, budgetStateIndicatorClasses, budgetStateTextClasses, progressPercent } from "@/lib/budgets"
import { formatAmount } from "@/lib/format"
import { cn } from "@/lib/utils"

const summaryTitles: Record<Periodicity, string> = {
  monthly: "Budgets mensuels",
  quarterly: "Budgets trimestriels",
  yearly: "Budgets annuels",
}

type BudgetsSummaryProps = {
  budgets: BudgetOverviewItem[]
  totals: BudgetsOverview["totals"]
}

function TotalsCard({ title, totals }: { title: string; totals: BudgetTotals }) {
  const state = budgetStateOf(totals.spent, totals.available)
  return (
    <Card>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">
          {formatAmount(totals.spent, BUDGET_CURRENCY)}
          <span className="text-sm font-normal text-muted-foreground">
            {" "}
            / {formatAmount(totals.available, BUDGET_CURRENCY)}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Progress
          value={progressPercent(budgetRatioOf(totals.spent, totals.available))}
          className="bg-muted"
          indicatorClassName={budgetStateIndicatorClasses[state]}
        />
      </CardContent>
    </Card>
  )
}

export function BudgetsSummary({ budgets, totals }: BudgetsSummaryProps) {
  const periods = PERIODICITIES.filter((period) => budgets.some((budget) => budget.period === period))
  const exceededCount = budgets.filter((budget) => budget.status.state === "exceeded").length
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {periods.map((period) => (
        <TotalsCard key={period} title={summaryTitles[period]} totals={totals[period]} />
      ))}
      <Card>
        <CardHeader>
          <CardDescription>Dépassements</CardDescription>
          <CardTitle className={cn("text-2xl tabular-nums", exceededCount > 0 && budgetStateTextClasses.exceeded)}>
            {exceededCount}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">Budgets dont la consommation dépasse le disponible</CardContent>
      </Card>
    </div>
  )
}
