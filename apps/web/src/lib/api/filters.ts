export const UNCATEGORIZED_FILTER = "none"
export const WITHOUT_FIXED_ITEM_FILTER = "none"

export type TransferFilter = "only" | "hide"

export type TransactionFilters = {
  accountId?: string | undefined
  from?: string | undefined
  to?: string | undefined
  search?: string | undefined
  categoryId?: string | undefined
  includeChildren?: boolean | undefined
  fixedItemId?: string | undefined
  transfer?: TransferFilter | undefined
}

export type TransactionPageFilters = TransactionFilters & {
  page: number
  pageSize: number
}

export type NormalizedTransactionFilter = {
  accountId: string | undefined
  from: string | undefined
  to: string | undefined
  search: string | undefined
  categoryId: string | undefined
  includeChildren: boolean | undefined
  fixedItemId: string | undefined
  isTransfer: boolean | undefined
}

function transferFlag(transfer: TransferFilter | undefined): boolean | undefined {
  if (transfer === undefined) return undefined
  return transfer === "only"
}

export function normalizeTransactionFilter(filters: TransactionFilters): NormalizedTransactionFilter {
  return {
    accountId: filters.accountId || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
    search: filters.search?.trim() || undefined,
    categoryId: filters.categoryId || undefined,
    includeChildren: filters.categoryId && filters.includeChildren ? true : undefined,
    fixedItemId: filters.fixedItemId || undefined,
    isTransfer: transferFlag(filters.transfer),
  }
}
