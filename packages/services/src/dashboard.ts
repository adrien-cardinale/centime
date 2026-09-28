import {
  balanceSeries,
  type BalancePoint,
  type BreakdownEntry,
  categoryRoots,
  defaultOverviewRange,
  type IsoDate,
  lastMonths,
  latestBalance,
  limitBreakdown,
  type PeriodRange,
  periodContaining,
  roundCents,
  UNCATEGORIZED_LABEL,
} from "@centime/core"
import { accounts, type DbExecutor, transactions } from "@centime/db"
import { and, asc, count, eq, gte, isNotNull, isNull, lt, lte, type SQL, sql } from "drizzle-orm"
import { budgetsOverview } from "./budgets"
import { type CategoryNode, loadCategoryNodes } from "./categories"
import { type Clock, systemClock, todayOf } from "./clock"
import { fixedItemsOverview } from "./fixed-items"
import { listTransactions } from "./transactions"

const SERIES_MONTHS = 12
const TOP_BUDGETS = 5
const UPCOMING_OCCURRENCES = 5
const RECENT_TRANSACTIONS = 8

type MonthTotals = { income: number; expenses: number }

export type MonthlyPoint = MonthTotals & { month: IsoDate; label: string }

type Comparison = { current: number; previous: number }

const monthKey = sql<string>`substr(${transactions.bookingDate}, 1, 7)`

function countedCondition(from: IsoDate, to: IsoDate): SQL | undefined {
  return and(
    isNull(transactions.deletedAt),
    eq(transactions.status, "booked"),
    eq(transactions.isTransfer, false),
    gte(transactions.bookingDate, from),
    lte(transactions.bookingDate, to),
  )
}

async function loadMonthTotals(db: DbExecutor, from: IsoDate, to: IsoDate): Promise<Map<string, MonthTotals>> {
  const rows = await db
    .select({
      month: monthKey,
      income: sql<number>`coalesce(sum(case when ${transactions.amount} > 0 then ${transactions.amount} else 0 end), 0)`,
      expenses: sql<number>`coalesce(sum(case when ${transactions.amount} < 0 then -${transactions.amount} else 0 end), 0)`,
    })
    .from(transactions)
    .where(countedCondition(from, to))
    .groupBy(monthKey)
  return new Map(
    rows.map((row) => [row.month, { income: roundCents(Number(row.income)), expenses: roundCents(Number(row.expenses)) }]),
  )
}

export async function monthlySeries(db: DbExecutor, months: PeriodRange[]): Promise<MonthlyPoint[]> {
  const first = months[0]
  const last = months.at(-1)
  if (!first || !last) return []
  const totals = await loadMonthTotals(db, first.start, last.end)
  return months.map((range) => ({
    month: range.start,
    label: range.label,
    ...(totals.get(range.start.slice(0, 7)) ?? { income: 0, expenses: 0 }),
  }))
}

function compare(series: MonthlyPoint[], pick: (point: MonthTotals) => number): Comparison {
  const current = series.at(-1)
  const previous = series.at(-2)
  return { current: current ? pick(current) : 0, previous: previous ? pick(previous) : 0 }
}

function netOf(point: MonthTotals): number {
  return roundCents(point.income - point.expenses)
}

async function countWhere(db: DbExecutor, condition: SQL | undefined): Promise<number> {
  const [row] = await db.select({ total: count() }).from(transactions).where(condition)
  return row?.total ?? 0
}

function countUncategorized(db: DbExecutor): Promise<number> {
  return countWhere(
    db,
    and(isNull(transactions.deletedAt), eq(transactions.isTransfer, false), isNull(transactions.categoryId)),
  )
}

function countPending(db: DbExecutor): Promise<number> {
  return countWhere(db, and(isNull(transactions.deletedAt), eq(transactions.status, "pending")))
}

async function loadCategorySpending(db: DbExecutor, month: PeriodRange) {
  const rows = await db
    .select({ categoryId: transactions.categoryId, amount: sql<number>`sum(-${transactions.amount})` })
    .from(transactions)
    .where(and(countedCondition(month.start, month.end), lt(transactions.amount, 0)))
    .groupBy(transactions.categoryId)
  return rows.map((row) => ({ categoryId: row.categoryId, amount: Number(row.amount) }))
}

function addTo(totals: Map<string | null, number>, key: string | null, amount: number): void {
  totals.set(key, (totals.get(key) ?? 0) + amount)
}

function toBreakdownEntry(key: string | null, amount: number, nodes: Map<string, CategoryNode>): BreakdownEntry {
  const node = key === null ? undefined : nodes.get(key)
  if (!node) return { categoryId: null, name: UNCATEGORIZED_LABEL, color: null, amount: roundCents(amount), kind: "uncategorized" }
  return { categoryId: node.id, name: node.name, color: node.color, amount: roundCents(amount), kind: "category" }
}

export async function categoryBreakdown(db: DbExecutor, month: PeriodRange): Promise<BreakdownEntry[]> {
  const [spending, nodes] = await Promise.all([loadCategorySpending(db, month), loadCategoryNodes(db)])
  const roots = categoryRoots(nodes)
  const totals = new Map<string | null, number>()
  for (const { categoryId, amount } of spending) {
    addTo(totals, categoryId === null ? null : (roots.get(categoryId) ?? null), amount)
  }
  const byId = new Map(nodes.map((node) => [node.id, node]))
  return limitBreakdown([...totals].map(([key, amount]) => toBreakdownEntry(key, amount, byId)))
}

async function loadBankBalances(db: DbExecutor): Promise<BalancePoint[]> {
  const rows = await db
    .select({
      accountId: transactions.accountId,
      bookingDate: transactions.bookingDate,
      balance: transactions.balanceAfter,
    })
    .from(transactions)
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(
      and(
        isNull(transactions.deletedAt),
        isNull(accounts.deletedAt),
        eq(accounts.kind, "bank"),
        isNotNull(transactions.balanceAfter),
      ),
    )
    .orderBy(asc(transactions.bookingDate), asc(transactions.createdAt))
  return rows.flatMap((row) => (row.balance === null ? [] : [{ ...row, balance: row.balance }]))
}

async function budgetHighlights(db: DbExecutor, date: IsoDate, today: IsoDate) {
  const { budgets } = await budgetsOverview(db, date, today)
  return {
    exceeded: budgets.filter((budget) => budget.status.state === "exceeded").length,
    top: [...budgets].sort((left, right) => right.status.ratio - left.status.ratio).slice(0, TOP_BUDGETS),
  }
}

async function fixedItemHighlights(db: DbExecutor, today: IsoDate) {
  const overview = await fixedItemsOverview(db, defaultOverviewRange(today), today)
  const upcoming = overview.items
    .flatMap((item) => item.occurrences.map((report) => ({ ...report, fixedItemName: item.fixedItemName })))
    .filter((report) => report.status !== "paid" && report.dueDate >= today)
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate))
    .slice(0, UPCOMING_OCCURRENCES)
  return { overdue: overview.totals.overdueCount, upcoming }
}

export async function dashboardOverview(db: DbExecutor, date: IsoDate, today: IsoDate) {
  const month = periodContaining("monthly", date)
  const months = lastMonths(month, SERIES_MONTHS)
  const [series, breakdown, allBalances, uncategorizedCount, pendingCount, budgets, fixed, recent] = await Promise.all([
    monthlySeries(db, months),
    categoryBreakdown(db, month),
    loadBankBalances(db),
    countUncategorized(db),
    countPending(db),
    budgetHighlights(db, date, today),
    fixedItemHighlights(db, today),
    listTransactions(db, isNull(transactions.deletedAt), { limit: RECENT_TRANSACTIONS, offset: 0 }),
  ])
  return {
    month,
    kpis: {
      bankBalance: latestBalance(allBalances),
      expenses: compare(series, (point) => point.expenses),
      income: compare(series, (point) => point.income),
      net: compare(series, netOf),
      uncategorizedCount,
      pendingCount,
      budgetsExceeded: budgets.exceeded,
      overdueOccurrences: fixed.overdue,
    },
    monthlySeries: series,
    categoryBreakdown: breakdown,
    balanceSeries: balanceSeries(allBalances, months).map(({ range, balance }) => ({
      month: range.start,
      label: range.label,
      balance,
    })),
    budgets: budgets.top,
    upcomingOccurrences: fixed.upcoming,
    recentTransactions: recent,
  }
}

export type DashboardOverview = Awaited<ReturnType<typeof dashboardOverview>>

export function getDashboard(db: DbExecutor, input: { date?: IsoDate | undefined }, clock: Clock = systemClock) {
  const today = todayOf(clock)
  return dashboardOverview(db, input.date ?? today, today)
}
