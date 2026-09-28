import { categoryWithDescendants, type IsoDate } from "@centime/core"
import { accounts, categories, type DbExecutor, fixedItems, transactions } from "@centime/db"
import { and, count, desc, eq, gte, inArray, isNull, lte, or, type SQL, sql } from "drizzle-orm"
import { loadCategoryNodes } from "./categories"

export const UNCATEGORIZED = "none"
export const WITHOUT_FIXED_ITEM = "none"

export type TransactionFilter = {
  accountId?: string | undefined
  from?: IsoDate | undefined
  to?: IsoDate | undefined
  search?: string | undefined
  categoryId?: string | undefined
  includeChildren?: boolean | undefined
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

async function categoryIdsOf(db: DbExecutor, categoryId: string, includeChildren: boolean): Promise<string[]> {
  if (!includeChildren) return [categoryId]
  return categoryWithDescendants(await loadCategoryNodes(db), categoryId)
}

async function categoryCondition(db: DbExecutor, categoryId: string, includeChildren: boolean): Promise<SQL> {
  if (categoryId === UNCATEGORIZED) return isNull(transactions.categoryId)
  return inArray(transactions.categoryId, await categoryIdsOf(db, categoryId, includeChildren))
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
    filter.categoryId ? await categoryCondition(db, filter.categoryId, filter.includeChildren ?? false) : undefined,
    filter.fixedItemId ? fixedItemCondition(filter.fixedItemId) : undefined,
    filter.isTransfer === undefined ? undefined : eq(transactions.isTransfer, filter.isTransfer),
  )
}

export function listTransactions(db: DbExecutor, condition: SQL | undefined, window: PageWindow) {
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
