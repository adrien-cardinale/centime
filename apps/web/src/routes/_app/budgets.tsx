import { PERIODICITIES, periodContaining } from "@centime/core"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { PiggyBank, Plus } from "lucide-react"
import { useState } from "react"
import { BudgetCard } from "@/components/budgets/budget-card"
import { BudgetDialog, type BudgetDialogTarget } from "@/components/budgets/budget-dialog"
import { BudgetsSummary } from "@/components/budgets/budgets-summary"
import { PeriodNavigator } from "@/components/period-navigator"
import { UnbudgetedSpending } from "@/components/budgets/unbudgeted-spending"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { BudgetOverviewItem, BudgetsOverview } from "@/lib/api"
import { isIsoDate, todayIso } from "@/lib/budgets"
import { budgetPeriodGroupLabels } from "@/lib/labels"
import { budgetsOverviewQuery, budgetsQuery, categoriesQuery } from "@/lib/queries"

type BudgetsSearch = { date?: string }

function validateBudgetsSearch(search: Record<string, unknown>): BudgetsSearch {
  return isIsoDate(search.date) ? { date: search.date } : {}
}

export const Route = createFileRoute("/_app/budgets")({
  validateSearch: validateBudgetsSearch,
  loaderDeps: ({ search }) => ({ date: search.date ?? todayIso() }),
  loader: ({ context, deps }) =>
    Promise.all([
      context.queryClient.prefetchQuery(budgetsOverviewQuery(deps.date)),
      context.queryClient.prefetchQuery(budgetsQuery),
      context.queryClient.prefetchQuery(categoriesQuery),
    ]),
  component: BudgetsPage,
})

type DialogState = { open: boolean; target: BudgetDialogTarget }

function BudgetsPage() {
  const { date = todayIso() } = Route.useSearch()
  const navigate = Route.useNavigate()
  const overview = useQuery(budgetsOverviewQuery(date))
  const [dialog, setDialog] = useState<DialogState>({ open: false, target: {} })

  const openDialog = (target: BudgetDialogTarget) => setDialog({ open: true, target })
  const changeDate = (next: string) => void navigate({ search: { date: next }, replace: true })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Budgets"
        description="Plafonds de dépenses variables par catégorie, hors postes fixes et transferts."
        actions={
          <Button onClick={() => openDialog({})}>
            <Plus />
            Nouveau budget
          </Button>
        }
      />
      <PeriodNavigator date={date} onChange={changeDate} />
      {overview.error && <p className="text-sm text-destructive">{overview.error.message}</p>}
      {overview.data ? (
        <BudgetsContent
          overview={overview.data}
          onEdit={(budget) => openDialog({ budget })}
          onCreate={(categoryId) => openDialog(categoryId ? { categoryId } : {})}
        />
      ) : (
        !overview.error && <BudgetsSkeleton />
      )}
      <BudgetDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((current) => ({ ...current, open }))}
        target={dialog.target}
      />
    </div>
  )
}

type BudgetsContentProps = {
  overview: BudgetsOverview
  onEdit: (budget: BudgetOverviewItem) => void
  onCreate: (categoryId?: string) => void
}

function BudgetsContent({ overview, onEdit, onCreate }: BudgetsContentProps) {
  const monthLabel = periodContaining("monthly", overview.date).label
  const unbudgeted = (
    <UnbudgetedSpending categories={overview.unbudgeted} monthLabel={monthLabel} onCreate={onCreate} />
  )
  if (overview.budgets.length === 0) {
    return (
      <>
        <EmptyState onCreate={() => onCreate()} />
        {unbudgeted}
      </>
    )
  }
  return (
    <>
      <BudgetsSummary budgets={overview.budgets} totals={overview.totals} />
      {PERIODICITIES.map((period) => (
        <BudgetGroup
          key={period}
          title={budgetPeriodGroupLabels[period]}
          budgets={overview.budgets.filter((budget) => budget.period === period)}
          onEdit={onEdit}
        />
      ))}
      {unbudgeted}
    </>
  )
}

type BudgetGroupProps = {
  title: string
  budgets: BudgetOverviewItem[]
  onEdit: (budget: BudgetOverviewItem) => void
}

function BudgetGroup({ title, budgets, onEdit }: BudgetGroupProps) {
  if (budgets.length === 0) return null
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {budgets.map((budget) => (
          <BudgetCard key={budget.id} budget={budget} onEdit={onEdit} />
        ))}
      </div>
    </section>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <PiggyBank className="size-8 text-muted-foreground" />
        <div className="space-y-1">
          <p className="font-medium">Aucun budget pour l'instant</p>
          <p className="text-sm text-muted-foreground">
            Fixez un plafond de dépenses pour une catégorie et suivez sa consommation période par période.
          </p>
        </div>
        <Button onClick={onCreate}>
          <Plus />
          Créer un budget
        </Button>
      </CardContent>
    </Card>
  )
}

function BudgetsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  )
}
