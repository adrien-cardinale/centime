import {
  type BudgetPayload,
  type BudgetStatus,
  computeBudgetStatus,
  type IsoDate,
  MAX_ROLLOVER_PERIODS,
  type Periodicity,
  type PeriodRange,
  type PeriodSpending,
  periodContaining,
  previousPeriods,
  roundCents,
} from "@centime/core"
import { budgets, categories, type DbExecutor, transactions } from "@centime/db"
import { and, eq, gte, isNotNull, isNull, lte, ne } from "drizzle-orm"
import { type CategoryNode, loadCategoryNodes } from "./categories"
import { type Clock, nowIso, systemClock, todayOf } from "./clock"
import { notFound, ServiceError } from "./errors"

const HISTORY_PERIODS = 6
const MAX_UNBUDGETED = 8

const NOT_FOUND = "Budget introuvable"
const UNKNOWN_CATEGORY = "Catégorie introuvable"
const DUPLICATE_BUDGET = "Cette catégorie a déjà un budget"

export type BudgetUpdate = BudgetPayload & { id: string }

export type BudgetEntry = Awaited<ReturnType<typeof listBudgets>>[number]

type EligibleTransaction = {
  categoryId: string
  bookingDate: IsoDate
  amount: number
  status: "booked" | "pending"
}

type BudgetPlan = {
  budget: BudgetEntry
  current: PeriodRange
  carryPeriods: PeriodRange[]
  history: PeriodRange[]
}

export type BudgetOverviewItem = BudgetEntry & { status: BudgetStatus; history: PeriodSpending[] }

export type BudgetTotals = { available: number; spent: number; remaining: number }

export type UnbudgetedCategory = { categoryId: string; categoryName: string; categoryColor: string; spent: number }

function activeBudget(id: string) {
  return and(eq(budgets.id, id), isNull(budgets.deletedAt))
}

export async function listBudgets(db: DbExecutor, onlyId?: string) {
  const rows = await db
    .select({
      id: budgets.id,
      categoryId: budgets.categoryId,
      categoryName: categories.name,
      categoryColor: categories.color,
      period: budgets.period,
      rollover: budgets.rollover,
      amount: budgets.amount,
      startDate: budgets.startDate,
    })
    .from(budgets)
    .innerJoin(categories, eq(budgets.categoryId, categories.id))
    .where(onlyId === undefined ? isNull(budgets.deletedAt) : activeBudget(onlyId))
  return rows.sort((left, right) => left.categoryName.localeCompare(right.categoryName, "fr"))
}

export async function findBudget(db: DbExecutor, id: string): Promise<BudgetEntry | undefined> {
  const [budget] = await listBudgets(db, id)
  return budget
}

async function categoryExists(db: DbExecutor, id: string): Promise<boolean> {
  const [row] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, id), isNull(categories.deletedAt)))
  return row !== undefined
}

async function categoryHasBudget(db: DbExecutor, categoryId: string, exceptId?: string): Promise<boolean> {
  const [row] = await db
    .select({ id: budgets.id })
    .from(budgets)
    .where(
      and(
        eq(budgets.categoryId, categoryId),
        isNull(budgets.deletedAt),
        exceptId === undefined ? undefined : ne(budgets.id, exceptId),
      ),
    )
  return row !== undefined
}

async function assertBudgetable(db: DbExecutor, categoryId: string, exceptId?: string): Promise<void> {
  if (!(await categoryExists(db, categoryId))) throw notFound(UNKNOWN_CATEGORY)
  if (await categoryHasBudget(db, categoryId, exceptId)) throw new ServiceError(DUPLICATE_BUDGET, 409)
}

async function requireBudget(db: DbExecutor, id: string): Promise<BudgetEntry> {
  const budget = await findBudget(db, id)
  if (!budget) throw notFound(NOT_FOUND)
  return budget
}

export async function createBudget(db: DbExecutor, payload: BudgetPayload): Promise<BudgetEntry> {
  await assertBudgetable(db, payload.categoryId)
  const [created] = await db.insert(budgets).values(payload).returning({ id: budgets.id })
  if (!created) throw new Error("Insertion du budget impossible")
  return requireBudget(db, created.id)
}

export async function updateBudget(db: DbExecutor, { id, ...payload }: BudgetUpdate): Promise<BudgetEntry> {
  await assertBudgetable(db, payload.categoryId, id)
  const [updated] = await db.update(budgets).set(payload).where(activeBudget(id)).returning({ id: budgets.id })
  if (!updated) throw notFound(NOT_FOUND)
  return requireBudget(db, id)
}

export async function deleteBudget(db: DbExecutor, { id }: { id: string }, clock: Clock = systemClock) {
  const [deleted] = await db
    .update(budgets)
    .set({ deletedAt: nowIso(clock) })
    .where(activeBudget(id))
    .returning({ id: budgets.id })
  if (!deleted) throw notFound(NOT_FOUND)
  return { id }
}

async function loadEligibleTransactions(db: DbExecutor, from: IsoDate, to: IsoDate): Promise<EligibleTransaction[]> {
  const rows = await db
    .select({
      categoryId: transactions.categoryId,
      bookingDate: transactions.bookingDate,
      amount: transactions.amount,
      status: transactions.status,
    })
    .from(transactions)
    .where(
      and(
        isNull(transactions.deletedAt),
        eq(transactions.isTransfer, false),
        isNull(transactions.fixedItemId),
        isNotNull(transactions.categoryId),
        gte(transactions.bookingDate, from),
        lte(transactions.bookingDate, to),
      ),
    )
  return rows.flatMap(({ categoryId, ...row }) => (categoryId === null ? [] : [{ ...row, categoryId }]))
}

function nearestBudgetedAncestor(
  startId: string,
  parents: Map<string, string | null>,
  budgeted: ReadonlySet<string>,
): string | null {
  const visited = new Set<string>()
  let current: string | null | undefined = startId
  while (current && !visited.has(current)) {
    if (budgeted.has(current)) return current
    visited.add(current)
    current = parents.get(current)
  }
  return null
}

function budgetedCategoryMap(nodes: CategoryNode[], budgeted: ReadonlySet<string>): Map<string, string> {
  const parents = new Map(nodes.map((node) => [node.id, node.parentId]))
  const mapping = new Map<string, string>()
  for (const node of nodes) {
    const target = nearestBudgetedAncestor(node.id, parents, budgeted)
    if (target !== null) mapping.set(node.id, target)
  }
  return mapping
}

function groupByBudgetedCategory(
  rows: EligibleTransaction[],
  mapping: Map<string, string>,
): Map<string, EligibleTransaction[]> {
  const groups = new Map<string, EligibleTransaction[]>()
  for (const row of rows) {
    const target = mapping.get(row.categoryId)
    if (target !== undefined) groups.set(target, [...(groups.get(target) ?? []), row])
  }
  return groups
}

function expenseOf(rows: EligibleTransaction[]): number {
  return Math.max(0, roundCents(-rows.reduce((sum, row) => sum + row.amount, 0)))
}

function spendingIn(rows: EligibleTransaction[], range: PeriodRange): PeriodSpending {
  const inRange = rows.filter((row) => row.bookingDate >= range.start && row.bookingDate <= range.end)
  return {
    range,
    spent: expenseOf(inRange.filter((row) => row.status === "booked")),
    pending: expenseOf(inRange.filter((row) => row.status === "pending")),
  }
}

function planBudget(budget: BudgetEntry, date: IsoDate): BudgetPlan {
  const current = periodContaining(budget.period, date)
  const carryPeriods = budget.rollover
    ? previousPeriods(budget.period, current, MAX_ROLLOVER_PERIODS).filter((range) => range.end >= budget.startDate)
    : []
  return { budget, current, carryPeriods, history: previousPeriods(budget.period, current, HISTORY_PERIODS) }
}

function loadWindow(plans: BudgetPlan[], month: PeriodRange): { from: IsoDate; to: IsoDate } {
  const ranges = [month, ...plans.flatMap((plan) => [plan.current, ...plan.carryPeriods, ...plan.history])]
  return {
    from: ranges.reduce((earliest, range) => (range.start < earliest ? range.start : earliest), month.start),
    to: ranges.reduce((latest, range) => (range.end > latest ? range.end : latest), month.end),
  }
}

function toOverviewItem(plan: BudgetPlan, rows: EligibleTransaction[], today: IsoDate): BudgetOverviewItem {
  const previous = plan.carryPeriods.map((range) => spendingIn(rows, range))
  return {
    ...plan.budget,
    status: computeBudgetStatus(plan.budget, spendingIn(rows, plan.current), previous, today),
    history: plan.history.map((range) => spendingIn(rows, range)),
  }
}

function totalsOf(items: BudgetOverviewItem[], period: Periodicity): BudgetTotals {
  const statuses = items.filter((item) => item.period === period).map((item) => item.status)
  const sum = (pick: (status: BudgetStatus) => number) =>
    roundCents(statuses.reduce((total, status) => total + pick(status), 0))
  return {
    available: sum((status) => status.available),
    spent: sum((status) => status.spent),
    remaining: sum((status) => status.remaining),
  }
}

function overviewTotals(items: BudgetOverviewItem[]): Record<Periodicity, BudgetTotals> {
  return {
    monthly: totalsOf(items, "monthly"),
    quarterly: totalsOf(items, "quarterly"),
    yearly: totalsOf(items, "yearly"),
  }
}

function unbudgetedCategories(
  rows: EligibleTransaction[],
  nodes: CategoryNode[],
  mapping: Map<string, string>,
  month: PeriodRange,
): UnbudgetedCategory[] {
  return nodes
    .filter((node) => !mapping.has(node.id))
    .map((node) => ({
      categoryId: node.id,
      categoryName: node.name,
      categoryColor: node.color,
      spent: spendingIn(
        rows.filter((row) => row.categoryId === node.id),
        month,
      ).spent,
    }))
    .filter((entry) => entry.spent > 0)
    .sort((left, right) => right.spent - left.spent)
    .slice(0, MAX_UNBUDGETED)
}

export async function budgetsOverview(db: DbExecutor, date: IsoDate, today: IsoDate) {
  const [entries, nodes] = await Promise.all([listBudgets(db), loadCategoryNodes(db)])
  const month = periodContaining("monthly", date)
  const plans = entries.map((budget) => planBudget(budget, date))
  const window = loadWindow(plans, month)
  const rows = await loadEligibleTransactions(db, window.from, window.to)
  const mapping = budgetedCategoryMap(nodes, new Set(entries.map((entry) => entry.categoryId)))
  const grouped = groupByBudgetedCategory(rows, mapping)
  const items = plans.map((plan) => toOverviewItem(plan, grouped.get(plan.budget.categoryId) ?? [], today))
  return {
    date,
    today,
    budgets: items,
    totals: overviewTotals(items),
    unbudgeted: unbudgetedCategories(rows, nodes, mapping, month),
  }
}

export function getBudgetsOverview(db: DbExecutor, input: { date?: IsoDate | undefined }, clock: Clock = systemClock) {
  const today = todayOf(clock)
  return budgetsOverview(db, input.date ?? today, today)
}
