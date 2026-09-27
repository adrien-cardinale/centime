import type { ReactNode } from "react"
import { Amount } from "@/components/amount"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { FixedItemsOverview } from "@/lib/api"
import { FIXED_ITEM_CURRENCY } from "@/lib/fixed-items"
import { formatAmount } from "@/lib/format"
import { cn } from "@/lib/utils"

type SummaryCardProps = {
  title: string
  value: ReactNode
  hint: string
}

function SummaryCard({ title, value, hint }: SummaryCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground">{hint}</CardContent>
    </Card>
  )
}

export function FixedItemsSummary({ totals }: { totals: FixedItemsOverview["totals"] }) {
  const { monthlyEquivalent, upcomingWithin30Days, overdueCount } = totals
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryCard
        title="Charges fixes mensualisées"
        value={<Amount amount={monthlyEquivalent.expenses} currency={FIXED_ITEM_CURRENCY} />}
        hint="Dépenses récurrentes ramenées au mois"
      />
      <SummaryCard
        title="Revenus fixes mensualisés"
        value={<Amount amount={monthlyEquivalent.incomes} currency={FIXED_ITEM_CURRENCY} />}
        hint="Revenus récurrents ramenés au mois"
      />
      <SummaryCard
        title="À venir sous 30 jours"
        value={upcomingWithin30Days.count}
        hint={`Montant attendu : ${formatAmount(upcomingWithin30Days.amount, FIXED_ITEM_CURRENCY)}`}
      />
      <SummaryCard
        title="En retard"
        value={<span className={cn(overdueCount > 0 && "text-destructive")}>{overdueCount}</span>}
        hint="Échéances passées sans transaction rattachée"
      />
    </div>
  )
}
