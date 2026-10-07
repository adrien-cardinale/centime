import type { MonthPlan } from "@centime/core"
import { useTranslation } from "react-i18next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BUDGET_CURRENCY } from "@/lib/budgets"
import { formatAmount } from "@/lib/format"
import { cn } from "@/lib/utils"

type PlanTileProps = {
  title: string
  value: number
  hint: string
  className?: string
}

function money(amount: number): string {
  return formatAmount(amount, BUDGET_CURRENCY)
}

function PlanTile({ title, value, hint, className }: PlanTileProps) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className={cn("text-2xl tabular-nums", className)}>{money(value)}</CardTitle>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground">{hint}</CardContent>
    </Card>
  )
}

export function PlanSummary({ plan }: { plan: MonthPlan }) {
  const { t } = useTranslation()
  const { income, fixedExpenses, envelopes, remaining } = plan
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <PlanTile title={t("budgets.planSummary.income")} value={income.expected} hint={t("budgets.planSummary.received", { amount: money(income.actual) })} />
      <PlanTile title={t("budgets.planSummary.fixedExpenses")} value={fixedExpenses.expected} hint={t("budgets.planSummary.paid", { amount: money(fixedExpenses.actual) })} />
      <PlanTile title={t("budgets.planSummary.envelopes")} value={envelopes.expected} hint={t("budgets.planSummary.spent", { amount: money(envelopes.actual) })} />
      <PlanTile
        title={t("budgets.planSummary.remaining")}
        value={remaining}
        hint={t("budgets.planSummary.remainingHint")}
        className={cn(remaining < 0 && "text-destructive")}
      />
    </div>
  )
}
