import type { MonthPlan } from "@centime/core"
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
  const { income, fixedExpenses, envelopes, remaining } = plan
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <PlanTile title="Revenus fixes" value={income.expected} hint={`Reçu : ${money(income.actual)}`} />
      <PlanTile title="Charges fixes" value={fixedExpenses.expected} hint={`Payé : ${money(fixedExpenses.actual)}`} />
      <PlanTile title="Enveloppes" value={envelopes.expected} hint={`Dépensé : ${money(envelopes.actual)}`} />
      <PlanTile
        title="Reste"
        value={remaining}
        hint="Revenus fixes − charges fixes − enveloppes"
        className={cn(remaining < 0 && "text-destructive")}
      />
    </div>
  )
}
