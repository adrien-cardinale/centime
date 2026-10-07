import {
  defaultOverviewRange,
  monthPlanOf,
  PERIODICITIES,
  type PeriodRange,
  type PlanLine,
  periodContaining,
  roundCents,
} from "@centime/core"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { PiggyBank, Plus } from "lucide-react"
import { type ReactNode, useState } from "react"
import { BudgetCard } from "@/components/budgets/budget-card"
import { BudgetDialog, type BudgetDialogTarget } from "@/components/budgets/budget-dialog"
import { LatestDataNotice } from "@/components/budgets/latest-data-notice"
import { PlanSummary } from "@/components/budgets/plan-summary"
import { UnbudgetedSpending } from "@/components/budgets/unbudgeted-spending"
import { EarlierOverdue } from "@/components/fixed-items/earlier-overdue"
import { FixedItemDialog } from "@/components/fixed-items/fixed-item-dialog"
import { FixedItemSheet } from "@/components/fixed-items/fixed-item-sheet"
import { FixedItemsTable } from "@/components/fixed-items/fixed-items-table"
import { PageHeader } from "@/components/page-header"
import { PeriodNavigator } from "@/components/period-navigator"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ColorDot } from "@/components/categories/color-dot"
import type { BudgetOverviewItem, BudgetsOverview, BudgetTotals, FixedItem, FixedItemsOverview, Theme } from "@/lib/api"
import { BUDGET_CURRENCY, isIsoDate, todayIso } from "@/lib/budgets"
import { directionOf, occurrenceIn } from "@/lib/fixed-items"
import { formatAmount } from "@/lib/format"
import { budgetPeriodGroupLabels } from "@/lib/labels"
import { budgetsOverviewQuery, budgetsQuery, categoriesQuery, fixedItemsOverviewQuery, fixedItemsQuery, themesQuery } from "@/lib/queries"

type BudgetsSearch = { date?: string }

function validateBudgetsSearch(search: Record<string, unknown>): BudgetsSearch {
  return isIsoDate(search.date) ? { date: search.date } : {}
}

export const Route = createFileRoute("/_app/budgets")({
  validateSearch: validateBudgetsSearch,
  loaderDeps: ({ search }) => ({ date: search.date ?? todayIso() }),
  loader: ({ context, deps }) => {
    const { from, to } = defaultOverviewRange(deps.date)
    return Promise.all([
      context.queryClient.prefetchQuery(budgetsOverviewQuery(deps.date)),
      context.queryClient.prefetchQuery(budgetsQuery),
      context.queryClient.prefetchQuery(fixedItemsQuery),
      context.queryClient.prefetchQuery(fixedItemsOverviewQuery(from, to)),
      context.queryClient.prefetchQuery(categoriesQuery),
      context.queryClient.prefetchQuery(themesQuery),
    ])
  },
  component: BudgetsPage,
})

type DialogState = { open: boolean; target: BudgetDialogTarget }

function money(amount: number): string {
  return formatAmount(amount, BUDGET_CURRENCY)
}

function BudgetsPage() {
  const { date = todayIso() } = Route.useSearch()
  const navigate = Route.useNavigate()
  const range = defaultOverviewRange(date)
  const month = periodContaining("monthly", date)
  const budgets = useQuery(budgetsOverviewQuery(date))
  const fixedItems = useQuery(fixedItemsQuery)
  const occurrences = useQuery(fixedItemsOverviewQuery(range.from, range.to))
  const error = budgets.error ?? fixedItems.error ?? occurrences.error
  const [dialog, setDialog] = useState<DialogState>({ open: false, target: {} })

  const openDialog = (target: BudgetDialogTarget) => setDialog({ open: true, target })
  const changeDate = (next: string) => void navigate({ search: { date: next }, replace: true })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Budget"
        description="Le plan du mois : revenus et charges fixes, puis enveloppes de dépenses variables par catégorie."
        actions={
          <div className="flex flex-wrap gap-2">
            <FixedItemDialog
              trigger={
                <Button variant="outline">
                  <Plus />
                  Nouveau poste fixe
                </Button>
              }
            />
            <Button onClick={() => openDialog({})}>
              <Plus />
              Nouveau budget
            </Button>
          </div>
        }
      />
      <PeriodNavigator date={date} onChange={changeDate} />
      <LatestDataNotice month={month} onSelect={changeDate} />
      {error && <p className="text-sm text-destructive">{error.message}</p>}
      {budgets.data && fixedItems.data && occurrences.data ? (
        <PlanContent
          month={month}
          budgets={budgets.data}
          fixedItems={fixedItems.data}
          occurrences={occurrences.data}
          onSelectDate={changeDate}
          onEditBudget={(budget) => openDialog({ budget })}
          onCreateBudget={(categoryId) => openDialog(categoryId ? { categoryId } : {})}
        />
      ) : (
        !error && <PlanSkeleton />
      )}
      <BudgetDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((current) => ({ ...current, open }))}
        target={dialog.target}
      />
    </div>
  )
}

type PlanContentProps = {
  month: PeriodRange
  budgets: BudgetsOverview
  fixedItems: FixedItem[]
  occurrences: FixedItemsOverview
  onSelectDate: (date: string) => void
  onEditBudget: (budget: BudgetOverviewItem) => void
  onCreateBudget: (categoryId?: string) => void
}

function PlanContent({ month, budgets, fixedItems, occurrences, onSelectDate, onEditBudget, onCreateBudget }: PlanContentProps) {
  const [viewedId, setViewedId] = useState<string | null>(null)
  const { data: themes = [] } = useQuery(themesQuery)
  const overviews = new Map(occurrences.items.map((entry) => [entry.fixedItemId, entry]))
  const viewed = fixedItems.find((item) => item.id === viewedId)
  const monthOccurrences = occurrences.items.flatMap((entry) => occurrenceIn(entry.occurrences, month) ?? [])
  const plan = monthPlanOf(monthOccurrences, budgets.envelopes)
  const incomes = fixedItems.filter((item) => directionOf(item.expectedAmount) === "income")
  const expenses = fixedItems.filter((item) => directionOf(item.expectedAmount) === "expense")

  return (
    <>
      <div className="space-y-3">
        <PlanSummary plan={plan} />
        <EarlierOverdue overviews={occurrences.items} month={month} onSelect={onSelectDate} />
      </div>
      <PlanSection title="Revenus fixes" aside={progressText("Reçu", plan.income)}>
        <Card className="py-0">
          <CardContent className="px-0">
            <FixedItemsTable
              items={incomes}
              overviews={overviews}
              month={month}
              emptyMessage="Aucun revenu fixe pour l'instant."
              onView={setViewedId}
            />
          </CardContent>
        </Card>
      </PlanSection>
      <PlanSection title="Charges fixes" aside={progressText("Payé", plan.fixedExpenses)}>
        <Card className="py-0">
          <CardContent className="px-0">
            <FixedItemsTable
              items={expenses}
              overviews={overviews}
              month={month}
              emptyMessage="Aucune charge fixe pour l'instant."
              onView={setViewedId}
            />
          </CardContent>
        </Card>
      </PlanSection>
      <PlanSection title="Enveloppes variables" aside={progressText("Dépensé", plan.envelopes)}>
        {budgets.budgets.length === 0 && <EmptyEnvelopes onCreate={() => onCreateBudget()} />}
        {PERIODICITIES.map((period) => (
          <BudgetGroup
            key={period}
            title={budgetPeriodGroupLabels[period]}
            totals={budgets.totals[period]}
            budgets={budgets.budgets.filter((budget) => budget.period === period)}
            themes={themes}
            onEdit={onEditBudget}
          />
        ))}
      </PlanSection>
      <UnbudgetedSpending categories={budgets.unbudgeted} monthLabel={month.label} onCreate={onCreateBudget} />
      <FixedItemSheet
        item={viewed}
        overview={viewed ? overviews.get(viewed.id) : undefined}
        onOpenChange={(open) => !open && setViewedId(null)}
      />
    </>
  )
}

function progressText(verb: string, line: PlanLine): string {
  return `${verb} ${money(line.actual)} sur ${money(line.expected)}`
}

function PlanSection({ title, aside, children }: { title: string; aside: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground tabular-nums">{aside}</p>
      </div>
      {children}
    </section>
  )
}

type BudgetGroupProps = {
  title: string
  totals: BudgetTotals
  budgets: BudgetOverviewItem[]
  themes: Theme[]
  onEdit: (budget: BudgetOverviewItem) => void
}

type ThemeBudgets = { theme: Theme | null; budgets: BudgetOverviewItem[]; totals: BudgetTotals }

function sumTotals(budgets: BudgetOverviewItem[]): BudgetTotals {
  const sum = (pick: (budget: BudgetOverviewItem) => number) =>
    roundCents(budgets.reduce((total, budget) => total + pick(budget), 0))
  return {
    available: sum((budget) => budget.status.available),
    spent: sum((budget) => budget.status.spent),
    remaining: sum((budget) => budget.status.remaining),
  }
}

function groupByTheme(budgets: BudgetOverviewItem[], themes: Theme[]): ThemeBudgets[] {
  const known = new Set(themes.map((theme) => theme.id))
  const groups = [
    ...themes.map((theme) => ({ theme, budgets: budgets.filter((budget) => budget.themeId === theme.id) })),
    { theme: null, budgets: budgets.filter((budget) => budget.themeId === null || !known.has(budget.themeId)) },
  ]
  return groups.filter((group) => group.budgets.length > 0).map((group) => ({ ...group, totals: sumTotals(group.budgets) }))
}

function BudgetGroup({ title, totals, budgets, themes, onEdit }: BudgetGroupProps) {
  if (budgets.length === 0) return null
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground tabular-nums">
          {money(totals.spent)} / {money(totals.available)}
        </p>
      </div>
      {groupByTheme(budgets, themes).map((group) => (
        <div key={group.theme?.id ?? "none"} className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b pb-1">
            <h4 className="flex items-center gap-2 text-sm font-semibold">
              {group.theme && <ColorDot color={group.theme.color} />}
              {group.theme?.name ?? "Sans thème"}
            </h4>
            <p className="text-xs text-muted-foreground tabular-nums">
              Sous-total : {money(group.totals.spent)} / {money(group.totals.available)}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {group.budgets.map((budget) => (
              <BudgetCard key={budget.id} budget={budget} onEdit={onEdit} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyEnvelopes({ onCreate }: { onCreate: () => void }) {
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

function PlanSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-48" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  )
}
