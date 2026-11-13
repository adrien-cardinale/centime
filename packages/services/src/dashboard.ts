import {
  balanceSeries,
  type BalancePoint,
  type BreakdownEntry,
  type IsoDate,
  lastMonths,
  latestBalance,
  limitBreakdown,
  type PeriodRange,
  periodContaining,
  roundCents,
  UNCATEGORIZED_LABEL,
} from "@centime/core"
import { accounts, type DbExecutor, themes, transactions, transactionSplits } from "@centime/db"
import { and, asc, count, eq, gte, isNotNull, isNull, lte, type SQL, sql } from "drizzle-orm"
import { loadBaseCurrencyContext } from "./base-currency"
import { budgetsOverview } from "./budgets"
import { loadCategoryNodes } from "./categories"
import { type Clock, systemClock, todayOf } from "./clock"
import { listTransactions } from "./transactions"

const SERIES_MONTHS = 12
const TOP_BUDGETS = 5
const RECENT_TRANSACTIONS = 8

type MonthTotals = { income: number; expenses: number }

export type MonthlyPoint = MonthTotals & { month: IsoDate; label: string }

type Comparison = { current: number; previous: number }

const monthKey = sql<string>`substr(${transactions.bookingDate}, 1, 7)`

function countedCondition(from: IsoDate, to: IsoDate, currency: string): SQL | undefined {
  return and(
    isNull(transactions.deletedAt),
    eq(transactions.currency, currency),
    eq(transactions.status, "booked"),
    eq(transactions.isTransfer, false),
    gte(transactions.bookingDate, from),
    lte(transactions.bookingDate, to),
  )
}

async function loadMonthTotals(
  db: DbExecutor,
  from: IsoDate,
  to: IsoDate,
  currency: string,
): Promise<Map<string, MonthTotals>> {
  const rows = await db
    .select({
      month: monthKey,
      income: sql<number>`coalesce(sum(case when ${transactions.amount} > 0 then ${transactions.amount} else 0 end), 0)`,
      expenses: sql<number>`coalesce(sum(case when ${transactions.amount} < 0 then -${transactions.amount} else 0 end), 0)`,
    })
    .from(transactions)
    .where(countedCondition(from, to, currency))
    .groupBy(monthKey)
  return new Map(
    rows.map((row) => [
      row.month,
      { income: roundCents(Number(row.income)), expenses: roundCents(Number(row.expenses)) },
    ]),
  )
}

export async function monthlySeries(db: DbExecutor, months: PeriodRange[], currency: string): Promise<MonthlyPoint[]> {
  const first = months[0]
  const last = months.at(-1)
  if (!first || !last) return []
  const totals = await loadMonthTotals(db, first.start, last.end, currency)
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
    and(
      isNull(transactions.deletedAt),
      eq(transactions.isTransfer, false),
      eq(transactions.isSplit, false),
      isNull(transactions.categoryId),
    ),
  )
}

function countPending(db: DbExecutor): Promise<number> {
  return countWhere(db, and(isNull(transactions.deletedAt), eq(transactions.status, "pending")))
}

type CategorySpendingRow = { categoryId: string | null; amount: number }

async function loadDirectSpending(
  db: DbExecutor,
  month: PeriodRange,
  currency: string,
): Promise<CategorySpendingRow[]> {
  const rows = await db
    .select({ categoryId: transactions.categoryId, amount: sql<number>`sum(-${transactions.amount})` })
    .from(transactions)
    .where(and(countedCondition(month.start, month.end, currency), eq(transactions.isSplit, false)))
    .groupBy(transactions.categoryId)
  return rows.map((row) => ({ categoryId: row.categoryId, amount: Number(row.amount) }))
}

async function loadSplitSpending(db: DbExecutor, month: PeriodRange, currency: string): Promise<CategorySpendingRow[]> {
  const rows = await db
    .select({ categoryId: transactionSplits.categoryId, amount: sql<number>`sum(-${transactionSplits.amount})` })
    .from(transactionSplits)
    .innerJoin(transactions, eq(transactionSplits.transactionId, transactions.id))
    .where(
      and(
        countedCondition(month.start, month.end, currency),
        eq(transactions.isSplit, true),
        isNull(transactionSplits.deletedAt),
      ),
    )
    .groupBy(transactionSplits.categoryId)
  return rows.map((row) => ({ categoryId: row.categoryId, amount: Number(row.amount) }))
}

// Dépenses nettes des remboursements, la même convention que les budgets (voir expenseOf dans budgets.ts).
async function loadCategorySpending(
  db: DbExecutor,
  month: PeriodRange,
  currency: string,
): Promise<CategorySpendingRow[]> {
  const [direct, split] = await Promise.all([
    loadDirectSpending(db, month, currency),
    loadSplitSpending(db, month, currency),
  ])
  return [...direct, ...split]
}

function addTo(totals: Map<string | null, number>, key: string | null, amount: number): void {
  totals.set(key, (totals.get(key) ?? 0) + amount)
}

type BreakdownLabel = { id: string; name: string; color: string }

function toBreakdownEntry(key: string | null, amount: number, labels: Map<string, BreakdownLabel>): BreakdownEntry {
  const rounded = roundCents(amount)
  const [kind, id = ""] = key === null ? [null] : key.split(":")
  const label = labels.get(key ?? "")
  if (!label || (kind !== "theme" && kind !== "category")) {
    return {
      themeId: null,
      categoryId: null,
      name: UNCATEGORIZED_LABEL,
      color: null,
      amount: rounded,
      kind: "uncategorized",
    }
  }
  return {
    themeId: kind === "theme" ? id : null,
    categoryId: kind === "category" ? id : null,
    name: label.name,
    color: label.color,
    amount: rounded,
    kind,
  }
}

function loadThemes(db: DbExecutor) {
  return db
    .select({ id: themes.id, name: themes.name, color: themes.color })
    .from(themes)
    .where(isNull(themes.deletedAt))
}

export async function categoryBreakdown(
  db: DbExecutor,
  month: PeriodRange,
  currency: string,
): Promise<BreakdownEntry[]> {
  const [spending, nodes, themeRows] = await Promise.all([
    loadCategorySpending(db, month, currency),
    loadCategoryNodes(db),
    loadThemes(db),
  ])
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const labels = new Map<string, BreakdownLabel>([
    ...themeRows.map((theme): [string, BreakdownLabel] => [`theme:${theme.id}`, theme]),
    ...nodes.map((node): [string, BreakdownLabel] => [`category:${node.id}`, node]),
  ])
  const totals = new Map<string | null, number>()
  for (const { categoryId, amount } of spending) {
    const node = categoryId === null ? undefined : nodeById.get(categoryId)
    const themeKey = node?.themeId && labels.has(`theme:${node.themeId}`) ? `theme:${node.themeId}` : null
    addTo(totals, node ? (themeKey ?? `category:${node.id}`) : null, amount)
  }
  // Un groupe au net négatif (catégorie de revenus, remboursement isolé) n'est pas une dépense : il sort du graphique.
  const spent = [...totals].filter(([, amount]) => roundCents(amount) > 0)
  return limitBreakdown(spent.map(([key, amount]) => toBreakdownEntry(key, amount, labels)))
}

async function loadBankBalances(db: DbExecutor, currency: string): Promise<BalancePoint[]> {
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
        eq(accounts.currency, currency),
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

export async function dashboardOverview(db: DbExecutor, date: IsoDate, today: IsoDate) {
  const month = periodContaining("monthly", date)
  const months = lastMonths(month, SERIES_MONTHS)
  const { currency, otherCurrencyAccounts } = await loadBaseCurrencyContext(db)
  const [series, breakdown, allBalances, uncategorizedCount, pendingCount, budgets, recent] = await Promise.all([
    monthlySeries(db, months, currency),
    categoryBreakdown(db, month, currency),
    loadBankBalances(db, currency),
    countUncategorized(db),
    countPending(db),
    budgetHighlights(db, date, today),
    listTransactions(db, isNull(transactions.deletedAt), { limit: RECENT_TRANSACTIONS, offset: 0 }),
  ])
  return {
    month,
    currency,
    otherCurrencyAccounts,
    kpis: {
      bankBalance: latestBalance(allBalances),
      expenses: compare(series, (point) => point.expenses),
      income: compare(series, (point) => point.income),
      net: compare(series, netOf),
      uncategorizedCount,
      pendingCount,
      budgetsExceeded: budgets.exceeded,
    },
    monthlySeries: series,
    categoryBreakdown: breakdown,
    balanceSeries: balanceSeries(allBalances, months).map(({ range, balance }) => ({
      month: range.start,
      label: range.label,
      balance,
    })),
    budgets: budgets.top,
    recentTransactions: recent,
  }
}

export type DashboardOverview = Awaited<ReturnType<typeof dashboardOverview>>

export function getDashboard(db: DbExecutor, input: { date?: IsoDate | undefined }, clock: Clock = systemClock) {
  const today = todayOf(clock)
  return dashboardOverview(db, input.date ?? today, today)
}
