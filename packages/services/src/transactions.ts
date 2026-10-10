import type { IsoDate } from "@centime/core"
import { accounts, categories, type DbExecutor, fixedItems, transactions, transactionSplits } from "@centime/db"
import { and, count, desc, eq, gte, inArray, isNull, lte, or, type SQL, sql } from "drizzle-orm"
import { loadTransactionSplits } from "./transaction-splits"

export const UNCATEGORIZED = "none"
export const WITHOUT_FIXED_ITEM = "none"

export type TransactionFilter = {
  accountId?: string | undefined
  from?: IsoDate | undefined
  to?: IsoDate | undefined
  search?: string | undefined
  categoryId?: string | undefined
  themeId?: string | undefined
  fixedItemId?: string | undefined
  isTransfer?: boolean | undefined
}

export type PageWindow = { limit: number; offset: number }

export type TransactionPageInput = TransactionFilter & { page: number; pageSize: number }

export type TransactionListItem = Awaited<ReturnType<typeof listTransactions>>[number]

const LIKE_SPECIAL_CHARACTERS = /[\\%_]/g

function containsPattern(search: string): string {
  return `%${search.toLowerCase().replace(LIKE_SPECIAL_CHARACTERS, (char) => `\\${char}`)}%`
}

function searchCondition(search: string): SQL | undefined {
  const pattern = containsPattern(search)
  return or(
    sql`lower(${transactions.rawLabel}) like ${pattern} escape '\\'`,
    sql`lower(${transactions.merchant}) like ${pattern} escape '\\'`,
  )
}

function hasSplitMatching(splitCategory: SQL): SQL {
  return sql`exists (select 1 from ${transactionSplits} where ${and(
    eq(transactionSplits.transactionId, transactions.id),
    isNull(transactionSplits.deletedAt),
    splitCategory,
  )})`
}

function categoryCondition(categoryId: string): SQL | undefined {
  if (categoryId === UNCATEGORIZED) return and(isNull(transactions.categoryId), eq(transactions.isSplit, false))
  return or(
    eq(transactions.categoryId, categoryId),
    and(eq(transactions.isSplit, true), hasSplitMatching(eq(transactionSplits.categoryId, categoryId))),
  )
}

function themeCategoryIds(themeId: string): SQL {
  return sql`(select ${categories.id} from ${categories} where ${categories.themeId} = ${themeId} and ${categories.deletedAt} is null)`
}

function themeCondition(themeId: string): SQL | undefined {
  const categoryIds = themeCategoryIds(themeId)
  return or(
    inArray(transactions.categoryId, categoryIds),
    and(eq(transactions.isSplit, true), hasSplitMatching(inArray(transactionSplits.categoryId, categoryIds))),
  )
}

function fixedItemCondition(fixedItemId: string): SQL {
  return fixedItemId === WITHOUT_FIXED_ITEM ? isNull(transactions.fixedItemId) : eq(transactions.fixedItemId, fixedItemId)
}

export async function transactionCondition(db: DbExecutor, filter: TransactionFilter): Promise<SQL | undefined> {
  return and(
    isNull(transactions.deletedAt),
    filter.accountId ? eq(transactions.accountId, filter.accountId) : undefined,
    filter.from ? gte(transactions.bookingDate, filter.from) : undefined,
    filter.to ? lte(transactions.bookingDate, filter.to) : undefined,
    filter.search ? searchCondition(filter.search) : undefined,
    filter.categoryId ? categoryCondition(filter.categoryId) : undefined,
    filter.themeId ? themeCondition(filter.themeId) : undefined,
    filter.fixedItemId ? fixedItemCondition(filter.fixedItemId) : undefined,
    filter.isTransfer === undefined ? undefined : eq(transactions.isTransfer, filter.isTransfer),
  )
}

function selectTransactions(db: DbExecutor, condition: SQL | undefined, window: PageWindow) {
  return db
    .select({
      id: transactions.id,
      accountId: transactions.accountId,
      accountName: accounts.name,
      bookingDate: transactions.bookingDate,
      valueDate: transactions.valueDate,
      rawLabel: transactions.rawLabel,
      merchant: transactions.merchant,
      providerCategory: transactions.providerCategory,
      amount: transactions.amount,
      currency: transactions.currency,
      status: transactions.status,
      categoryId: transactions.categoryId,
      categoryName: categories.name,
      categoryColor: categories.color,
      fixedItemId: transactions.fixedItemId,
      fixedItemName: fixedItems.name,
      isTransfer: transactions.isTransfer,
      isSplit: transactions.isSplit,
      balanceAfter: transactions.balanceAfter,
    })
    .from(transactions)
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .leftJoin(fixedItems, eq(transactions.fixedItemId, fixedItems.id))
    .where(condition)
    .orderBy(desc(transactions.bookingDate), desc(transactions.createdAt), desc(transactions.id))
    .limit(window.limit)
    .offset(window.offset)
}

export async function listTransactions(db: DbExecutor, condition: SQL | undefined, window: PageWindow) {
  const rows = await selectTransactions(db, condition, window)
  const splitIds = rows.filter((row) => row.isSplit).map((row) => row.id)
  const splits = await loadTransactionSplits(db, splitIds)
  return rows.map((row) => ({ ...row, splits: splits.get(row.id) ?? [] }))
}

export async function countTransactions(db: DbExecutor, condition: SQL | undefined): Promise<number> {
  const [row] = await db.select({ total: count() }).from(transactions).where(condition)
  return row?.total ?? 0
}

export async function listTransactionPage(db: DbExecutor, { page, pageSize, ...filter }: TransactionPageInput) {
  const condition = await transactionCondition(db, filter)
  const window = { limit: pageSize, offset: (page - 1) * pageSize }
  const [items, total] = await Promise.all([listTransactions(db, condition, window), countTransactions(db, condition)])
  return { items, total, page, pageSize }
}
