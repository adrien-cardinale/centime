import { monthPlanOf, type PeriodRange, type PlanLine, periodContaining } from "@centime/core"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { PiggyBank, Plus } from "lucide-react"
import { type ReactNode, useState } from "react"
import { useTranslation } from "react-i18next"
import { BudgetDialog, type BudgetDialogTarget } from "@/components/budgets/budget-dialog"
import { IncomeTable } from "@/components/budgets/income-table"
import { LatestDataNotice } from "@/components/budgets/latest-data-notice"
import { PlanSummary } from "@/components/budgets/plan-summary"
import { PlanTable } from "@/components/budgets/plan-table"
import { UnbudgetedSpending } from "@/components/budgets/unbudgeted-spending"
import { PageHeader } from "@/components/page-header"
import { PeriodNavigator } from "@/components/period-navigator"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { BudgetsOverview } from "@/lib/api"
import { BUDGET_CURRENCY, isIsoDate, todayIso } from "@/lib/budgets"
import type { EditableBudget } from "@/components/budgets/budget-form-values"
import i18n from "@/i18n"
import { formatAmount } from "@/lib/format"
import { budgetsOverviewQuery, budgetsQuery, categoriesQuery, themesQuery } from "@/lib/queries"

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
      context.queryClient.prefetchQuery(themesQuery),
    ]),
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
  const month = periodContaining("monthly", date)
  const budgets = useQuery(budgetsOverviewQuery(date))
  const [dialog, setDialog] = useState<DialogState>({ open: false, target: {} })

  const openDialog = (target: BudgetDialogTarget) => setDialog({ open: true, target })
  const changeDate = (next: string) => void navigate({ search: { date: next }, replace: true, resetScroll: false })

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("budgetsPage.title")}
        description={t("budgetsPage.description")}
        actions={
          <Button size="sm" className="w-full sm:h-9 sm:w-auto sm:px-4" onClick={() => openDialog({})}>
            <Plus />
            {t("budgetsPage.add")}
          </Button>
        }
      />
      <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-[5] -mx-4 -mt-2 border-b bg-background/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
        <PeriodNavigator date={date} onChange={changeDate} />
      </div>
      <LatestDataNotice month={month} onSelect={changeDate} />
      {budgets.error && <p className="text-sm text-destructive">{budgets.error.message}</p>}
      {budgets.data ? (
        <PlanContent
          month={month}
          budgets={budgets.data}
          onEditBudget={(budget) => openDialog({ budget })}
          onCreateBudget={(categoryId) => openDialog(categoryId ? { categoryId } : {})}
        />
      ) : (
        !budgets.error && <PlanSkeleton />
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
  onEditBudget: (budget: EditableBudget) => void
  onCreateBudget: (categoryId?: string) => void
}

function PlanContent({ month, budgets, onEditBudget, onCreateBudget }: PlanContentProps) {
  const { t } = useTranslation()
  const { data: themes = [] } = useQuery(themesQuery)
  const plan = monthPlanOf(budgets.income, budgets.envelopes)

  return (
    <>
      <PlanSummary plan={plan} />
      <UnbudgetedSpending categories={budgets.unbudgeted} monthLabel={month.label} onCreate={onCreateBudget} />
      <PlanSection title={t("budgetsPage.expenses")} aside={progressText("budgetsPage.progressSpent", plan.envelopes)}>
        {budgets.budgets.length === 0 && <EmptyExpenses />}
        {budgets.budgets.length > 0 && (
          <Card className="py-0">
            <CardContent className="px-0">
              <PlanTable budgets={budgets.budgets} themes={themes} onEdit={onEditBudget} />
            </CardContent>
          </Card>
        )}
      </PlanSection>
      <PlanSection title={t("budgetsPage.income")} aside={progressText("budgetsPage.progressReceived", plan.income)}>
        <Card className="py-0">
          <CardContent className="px-0">
            {budgets.incomes.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">{t("budgetsPage.emptyIncome")}</p>
            ) : (
              <IncomeTable incomes={budgets.incomes} onEdit={onEditBudget} />
            )}
          </CardContent>
        </Card>
      </PlanSection>
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

function EmptyExpenses() {
  const { t } = useTranslation()
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <PiggyBank className="size-8 text-muted-foreground" />
        <div className="space-y-1">
          <p className="font-medium">{t("budgetsPage.emptyExpensesTitle")}</p>
          <p className="text-sm text-muted-foreground">{t("budgetsPage.emptyExpensesDescription")}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function PlanSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
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
