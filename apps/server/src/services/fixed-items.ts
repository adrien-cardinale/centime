import {
  type DateRange,
  type FixedItemPayload,
  type MatchedTransaction,
  matchOccurrences,
  monthlyEquivalent,
  nextOccurrence,
  type OccurrenceReport,
  occurrencesBetween,
  reportOccurrences,
  type RuleMatcherInput,
  roundCents,
  shiftDays,
  summarizeItem,
} from "@centime/core"
import { accounts, categories, type Db, type DbExecutor, type FixedItemRow, fixedItems, rules, transactions } from "@centime/db"
import { and, asc, count, desc, eq, gte, isNotNull, isNull, lte } from "drizzle-orm"
import { categorizeTransactions, loadCategorizableTransactions } from "./categorize"

const FIXED_ITEM_RULE_PRIORITY = 60
const TRANSACTION_MARGIN_DAYS = 30
const UPCOMING_HORIZON_DAYS = 30

type LinkedRule = RuleMatcherInput & { id: string }

export function activeFixedItem(id: string) {
  return and(eq(fixedItems.id, id), isNull(fixedItems.deletedAt))
}

function linkedRulesCondition(fixedItemId: string) {
  return and(eq(rules.fixedItemId, fixedItemId), isNull(rules.deletedAt))
}

export async function isActiveCategory(db: DbExecutor, id: string | null): Promise<boolean> {
  if (id === null) return true
  const [row] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, id), isNull(categories.deletedAt)))
  return row !== undefined
}

async function loadLinkedRules(db: DbExecutor): Promise<Map<string, LinkedRule>> {
  const rows = await db
    .select({
      id: rules.id,
      fixedItemId: rules.fixedItemId,
      pattern: rules.pattern,
      matchKind: rules.matchKind,
      field: rules.field,
    })
    .from(rules)
    .where(and(isNotNull(rules.fixedItemId), isNull(rules.deletedAt)))
    .orderBy(asc(rules.createdAt))
  const byItem = new Map<string, LinkedRule>()
  for (const { fixedItemId, ...rule } of rows) {
    if (fixedItemId !== null && !byItem.has(fixedItemId)) byItem.set(fixedItemId, rule)
  }
  return byItem
}

async function loadLinkedCounts(db: DbExecutor): Promise<Map<string, number>> {
  const rows = await db
    .select({ fixedItemId: transactions.fixedItemId, linkedCount: count() })
    .from(transactions)
    .where(and(isNotNull(transactions.fixedItemId), isNull(transactions.deletedAt)))
    .groupBy(transactions.fixedItemId)
  return new Map(rows.flatMap((row) => (row.fixedItemId === null ? [] : [[row.fixedItemId, row.linkedCount]])))
}

function byName(left: { name: string }, right: { name: string }): number {
  return left.name.localeCompare(right.name, "fr")
}

export async function listFixedItems(db: DbExecutor, onlyId?: string) {
  const [rows, linkedRules, linkedCounts] = await Promise.all([
    db
      .select({
        id: fixedItems.id,
        name: fixedItems.name,
        expectedAmount: fixedItems.expectedAmount,
        periodicity: fixedItems.periodicity,
        dueDay: fixedItems.dueDay,
        dueMonth: fixedItems.dueMonth,
        categoryId: fixedItems.categoryId,
        categoryName: categories.name,
        categoryColor: categories.color,
        startDate: fixedItems.startDate,
        endDate: fixedItems.endDate,
      })
      .from(fixedItems)
      .leftJoin(categories, eq(fixedItems.categoryId, categories.id))
      .where(onlyId === undefined ? isNull(fixedItems.deletedAt) : activeFixedItem(onlyId)),
    loadLinkedRules(db),
    loadLinkedCounts(db),
  ])
  return rows.sort(byName).map((row) => ({
    ...row,
    monthlyEquivalent: monthlyEquivalent(row),
    rule: linkedRules.get(row.id) ?? null,
    linkedCount: linkedCounts.get(row.id) ?? 0,
  }))
}

export async function findFixedItem(db: DbExecutor, id: string) {
  const [item] = await listFixedItems(db, id)
  return item
}

function toItemRow({ rule: _rule, ...item }: FixedItemPayload) {
  return item
}

function toRuleRow(fixedItemId: string, categoryId: string | null, matcher: RuleMatcherInput) {
  return { ...matcher, fixedItemId, categoryId, markAsTransfer: false, priority: FIXED_ITEM_RULE_PRIORITY }
}

async function linkMatchingTransactions(db: DbExecutor): Promise<void> {
  await categorizeTransactions(db, await loadCategorizableTransactions(db), "uncategorized")
}

export async function createFixedItem(db: Db, payload: FixedItemPayload): Promise<string> {
  return db.transaction(async (tx) => {
    const [created] = await tx.insert(fixedItems).values(toItemRow(payload)).returning({ id: fixedItems.id })
    if (!created) throw new Error("Insertion du poste fixe impossible")
    if (payload.rule) {
      await tx.insert(rules).values(toRuleRow(created.id, payload.categoryId, payload.rule))
      await linkMatchingTransactions(tx)
    }
    return created.id
  })
}

async function removeLinkedRules(db: DbExecutor, fixedItemId: string): Promise<void> {
  await db.update(rules).set({ deletedAt: new Date().toISOString() }).where(linkedRulesCondition(fixedItemId))
}

async function upsertLinkedRule(db: DbExecutor, fixedItemId: string, categoryId: string | null, matcher: RuleMatcherInput) {
  const [existing] = await db
    .select({ id: rules.id })
    .from(rules)
    .where(linkedRulesCondition(fixedItemId))
    .orderBy(asc(rules.createdAt))
    .limit(1)
  if (existing) await db.update(rules).set(matcher).where(eq(rules.id, existing.id))
  else await db.insert(rules).values(toRuleRow(fixedItemId, categoryId, matcher))
  await linkMatchingTransactions(db)
}

async function syncLinkedRules(db: DbExecutor, fixedItemId: string, payload: FixedItemPayload): Promise<void> {
  if (payload.rule === null) return removeLinkedRules(db, fixedItemId)
  await db.update(rules).set({ categoryId: payload.categoryId }).where(linkedRulesCondition(fixedItemId))
  if (payload.rule) await upsertLinkedRule(db, fixedItemId, payload.categoryId, payload.rule)
}

export async function updateFixedItem(db: Db, id: string, payload: FixedItemPayload): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(fixedItems)
      .set(toItemRow(payload))
      .where(activeFixedItem(id))
      .returning({ id: fixedItems.id })
    if (!updated) return false
    await syncLinkedRules(tx, id, payload)
    return true
  })
}

export async function deleteFixedItem(db: Db, id: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [deleted] = await tx
      .update(fixedItems)
      .set({ deletedAt: new Date().toISOString() })
      .where(activeFixedItem(id))
      .returning({ id: fixedItems.id })
    if (!deleted) return false
    await tx.update(transactions).set({ fixedItemId: null }).where(eq(transactions.fixedItemId, id))
    await removeLinkedRules(tx, id)
    return true
  })
}

export function listLinkedTransactions(db: DbExecutor, fixedItemId: string) {
  return db
    .select({
      id: transactions.id,
      bookingDate: transactions.bookingDate,
      rawLabel: transactions.rawLabel,
      merchant: transactions.merchant,
      amount: transactions.amount,
      currency: transactions.currency,
      accountName: accounts.name,
    })
    .from(transactions)
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(and(eq(transactions.fixedItemId, fixedItemId), isNull(transactions.deletedAt)))
    .orderBy(desc(transactions.bookingDate), desc(transactions.createdAt))
}

async function loadMatchedTransactions(db: DbExecutor, range: DateRange): Promise<Map<string, MatchedTransaction[]>> {
  const rows = await db
    .select({
      id: transactions.id,
      fixedItemId: transactions.fixedItemId,
      bookingDate: transactions.bookingDate,
      amount: transactions.amount,
      rawLabel: transactions.rawLabel,
    })
    .from(transactions)
    .where(
      and(
        isNotNull(transactions.fixedItemId),
        isNull(transactions.deletedAt),
        gte(transactions.bookingDate, shiftDays(range.from, -TRANSACTION_MARGIN_DAYS)),
        lte(transactions.bookingDate, shiftDays(range.to, TRANSACTION_MARGIN_DAYS)),
      ),
    )
  const byItem = new Map<string, MatchedTransaction[]>()
  for (const { fixedItemId, ...transaction } of rows) {
    if (fixedItemId === null) continue
    byItem.set(fixedItemId, [...(byItem.get(fixedItemId) ?? []), transaction])
  }
  return byItem
}

function statusOf(reports: OccurrenceReport[], dueDate: string) {
  return reports.find((report) => report.dueDate === dueDate)?.status
}

function nextReport(item: FixedItemRow, reports: OccurrenceReport[], today: string): OccurrenceReport | null {
  const next = nextOccurrence(item, today)
  if (!next) return null
  return reports.find((report) => report.dueDate === next.dueDate) ?? matchOccurrences([next], [], today)[0] ?? null
}

function upcomingUnpaid(item: FixedItemRow, reports: OccurrenceReport[], today: string) {
  return occurrencesBetween(item, today, shiftDays(today, UPCOMING_HORIZON_DAYS)).filter(
    (occurrence) => statusOf(reports, occurrence.dueDate) !== "paid",
  )
}

function isRunning(item: FixedItemRow, today: string): boolean {
  return item.endDate === null || item.endDate >= today
}

type ItemOverview = {
  item: FixedItemRow
  occurrences: OccurrenceReport[]
  upcoming: ReturnType<typeof occurrencesBetween>
}

function sumOf(values: number[]): number {
  return roundCents(values.reduce((sum, value) => sum + value, 0))
}

function overviewTotals(overviews: ItemOverview[], today: string) {
  const monthly = overviews.filter(({ item }) => isRunning(item, today)).map(({ item }) => monthlyEquivalent(item))
  const reports = overviews.flatMap((overview) => overview.occurrences)
  const upcoming = overviews.flatMap((overview) => overview.upcoming)
  return {
    monthlyEquivalent: {
      expenses: sumOf(monthly.filter((amount) => amount < 0)),
      incomes: sumOf(monthly.filter((amount) => amount > 0)),
    },
    overdueCount: reports.filter((report) => report.status === "overdue").length,
    dueCount: reports.filter((report) => report.status === "due").length,
    upcomingWithin30Days: {
      count: upcoming.length,
      amount: sumOf(upcoming.map((occurrence) => occurrence.expectedAmount)),
    },
  }
}

export async function fixedItemsOverview(db: DbExecutor, range: DateRange, today: string) {
  const [items, matched] = await Promise.all([
    db.select().from(fixedItems).where(isNull(fixedItems.deletedAt)),
    loadMatchedTransactions(db, range),
  ])
  const overviews: ItemOverview[] = items.sort(byName).map((item) => {
    const occurrences = reportOccurrences(item, matched.get(item.id) ?? [], range, today)
    return { item, occurrences, upcoming: upcomingUnpaid(item, occurrences, today) }
  })
  return {
    ...range,
    today,
    items: overviews.map(({ item, occurrences }) => ({
      fixedItemId: item.id,
      fixedItemName: item.name,
      occurrences,
      summary: summarizeItem(occurrences),
      nextOccurrence: nextReport(item, occurrences, today),
    })),
    totals: overviewTotals(overviews, today),
  }
}
