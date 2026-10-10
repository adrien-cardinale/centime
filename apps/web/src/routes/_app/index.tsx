import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { Upload } from "lucide-react"
import { useTranslation } from "react-i18next"
import { BalanceChart } from "@/components/dashboard/balance-chart"
import { BudgetsCard } from "@/components/dashboard/budgets-card"
import { CategoryBreakdownChart } from "@/components/dashboard/category-breakdown-chart"
import { DashboardAlerts } from "@/components/dashboard/dashboard-alerts"
import { IncomeExpensesChart } from "@/components/dashboard/income-expenses-chart"
import { KpiTiles } from "@/components/dashboard/kpi-tiles"
import { RecentTransactionsCard } from "@/components/dashboard/recent-transactions-card"
import { UpcomingCard } from "@/components/dashboard/upcoming-card"
import { PageHeader } from "@/components/page-header"
import { PeriodNavigator } from "@/components/period-navigator"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { DashboardOverview } from "@/lib/api"
import { isIsoDate, todayIso } from "@/lib/budgets"
import { dashboardQuery } from "@/lib/queries"

type DashboardSearch = { date?: string }

function validateDashboardSearch(search: Record<string, unknown>): DashboardSearch {
  return isIsoDate(search.date) ? { date: search.date } : {}
}

export const Route = createFileRoute("/_app/")({
  validateSearch: validateDashboardSearch,
  loaderDeps: ({ search }) => ({ date: search.date ?? todayIso() }),
  loader: ({ context, deps }) => context.queryClient.prefetchQuery(dashboardQuery(deps.date)),
  component: DashboardPage,
})

function DashboardPage() {
  const { t } = useTranslation()
  const { date = todayIso() } = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data, error } = useQuery(dashboardQuery(date))
  const changeDate = (next: string) => void navigate({ search: { date: next }, replace: true })

  return (
    <div className="space-y-6">
      <PageHeader title={t("nav.dashboard")} actions={<PeriodNavigator date={date} onChange={changeDate} />} />
      {error && <p className="text-sm text-destructive">{error.message}</p>}
      {data ? <DashboardContent overview={data} /> : !error && <DashboardSkeleton />}
    </div>
  )
}

function DashboardContent({ overview }: { overview: DashboardOverview }) {
  if (overview.recentTransactions.length === 0) return <EmptyDashboard />
  return (
    <>
      <div className="space-y-3">
        <KpiTiles kpis={overview.kpis} />
        <DashboardAlerts kpis={overview.kpis} />
      </div>
      <IncomeExpensesChart series={overview.monthlySeries} />
      <div className="grid gap-4 lg:grid-cols-2">
        <CategoryBreakdownChart entries={overview.categoryBreakdown} month={overview.month} />
        <BalanceChart series={overview.balanceSeries} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <BudgetsCard budgets={overview.budgets} />
        <UpcomingCard occurrences={overview.upcomingOccurrences} />
        <RecentTransactionsCard transactions={overview.recentTransactions} />
      </div>
    </>
  )
}

function EmptyDashboard() {
  const { t } = useTranslation()
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <Upload className="size-8 text-muted-foreground" />
        <div className="space-y-1">
          <p className="font-medium">{t("dashboardPage.emptyTitle")}</p>
          <p className="text-sm text-muted-foreground">
            {t("dashboardPage.emptyDescription")}
          </p>
        </div>
        <Button asChild>
          <Link to="/import">{t("dashboardPage.importStatement")}</Link>
        </Button>
      </CardContent>
    </Card>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {["balance", "expenses", "income", "net"].map((key) => (
          <Skeleton key={key} className="h-24 sm:h-28" />
        ))}
      </div>
      <Skeleton className="h-80" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  )
}
