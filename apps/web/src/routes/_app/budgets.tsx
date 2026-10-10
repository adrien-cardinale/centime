import {
  defaultOverviewRange,
  monthPlanOf,
  type PeriodRange,
  type PlanLine,
  periodContaining,
} from "@centime/core"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { PiggyBank, Plus } from "lucide-react"
import { type ReactNode, useState } from "react"
import { useTranslation } from "react-i18next"
import { BudgetsTable } from "@/components/budgets/budgets-table"
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
import type { BudgetOverviewItem, BudgetsOverview, FixedItem, FixedItemsOverview } from "@/lib/api"
import { BUDGET_CURRENCY, isIsoDate, todayIso } from "@/lib/budgets"
import { directionOf, occurrenceIn } from "@/lib/fixed-items"
import i18n from "@/i18n"
import { formatAmount } from "@/lib/format"
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
  const { t } = useTranslation()
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
  const changeDate = (next: string) => void navigate({ search: { date: next }, replace: true, resetScroll: false })

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("budgetsPage.title")}
        description={t("budgetsPage.description")}
        actions={
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <FixedItemDialog
              trigger={
                <Button variant="outline" size="sm" className="grow sm:h-9 sm:grow-0 sm:px-4">
                  <Plus />
                  {t("budgetsPage.newFixedItem")}
                </Button>
              }
            />
            <Button size="sm" className="grow sm:h-9 sm:grow-0 sm:px-4" onClick={() => openDialog({})}>
              <Plus />
              {t("budgetsPage.newBudget")}
            </Button>
          </div>
        }
      />
      <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-[5] -mx-4 -mt-2 border-b bg-background/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
        <PeriodNavigator date={date} onChange={changeDate} />
      </div>
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
  const { t } = useTranslation()
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
      <UnbudgetedSpending categories={budgets.unbudgeted} monthLabel={month.label} onCreate={onCreateBudget} />
      <PlanSection title={t("budgetsPage.variableEnvelopes")} aside={progressText("budgetsPage.progressSpent", plan.envelopes)}>
        {budgets.budgets.length === 0 && <EmptyEnvelopes onCreate={() => onCreateBudget()} />}
        {budgets.budgets.length > 0 && (
          <Card className="py-0">
            <CardContent className="px-0">
              <BudgetsTable budgets={budgets.budgets} themes={themes} onEdit={onEditBudget} />
            </CardContent>
          </Card>
        )}
      </PlanSection>
      <PlanSection title={t("budgetsPage.fixedExpenses")} aside={progressText("budgetsPage.progressPaid", plan.fixedExpenses)}>
        <Card className="py-0">
          <CardContent className="px-0">
            <FixedItemsTable
              items={expenses}
              overviews={overviews}
              month={month}
              emptyMessage={t("budgetsPage.emptyFixedExpenses")}
              onView={setViewedId}
            />
          </CardContent>
        </Card>
      </PlanSection>
      <PlanSection title={t("budgetsPage.fixedIncome")} aside={progressText("budgetsPage.progressReceived", plan.income)}>
        <Card className="py-0">
          <CardContent className="px-0">
            <FixedItemsTable
              items={incomes}
              overviews={overviews}
              month={month}
              emptyMessage={t("budgetsPage.emptyFixedIncome")}
              onView={setViewedId}
            />
          </CardContent>
        </Card>
      </PlanSection>
      <FixedItemSheet
        item={viewed}
        overview={viewed ? overviews.get(viewed.id) : undefined}
        onOpenChange={(open) => !open && setViewedId(null)}
      />
    </>
  )
}

function progressText(key: string, line: PlanLine): string {
  return i18n.t(key, { actual: money(line.actual), expected: money(line.expected) })
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

function EmptyEnvelopes({ onCreate }: { onCreate: () => void }) {
  const { t } = useTranslation()
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <PiggyBank className="size-8 text-muted-foreground" />
        <div className="space-y-1">
          <p className="font-medium">{t("budgetsPage.emptyBudgetsTitle")}</p>
          <p className="text-sm text-muted-foreground">
            {t("budgetsPage.emptyBudgetsDescription")}
          </p>
        </div>
        <Button onClick={onCreate}>
          <Plus />
          {t("budgetsPage.createBudget")}
        </Button>
      </CardContent>
    </Card>
  )
}

function PlanSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Skeleton className="h-24 sm:h-28" />
        <Skeleton className="h-24 sm:h-28" />
        <Skeleton className="h-24 sm:h-28" />
        <Skeleton className="h-24 sm:h-28" />
      </div>
      <Skeleton className="h-48" />
      <Skeleton className="h-64" />
      <Skeleton className="h-64" />
    </div>
  )
}
