import { keepPreviousData, type QueryClient, queryOptions } from "@tanstack/react-query"
import { api, type ImportUpload, type TransactionPageFilters } from "./api"

export const authQuery = queryOptions({
  queryKey: ["auth", "me"],
  queryFn: api.auth.me,
  staleTime: 60_000,
})

export const accountsQuery = queryOptions({
  queryKey: ["accounts"],
  queryFn: api.accounts.list,
})

export const csvProfilesQuery = queryOptions({
  queryKey: ["csv-profiles"],
  queryFn: api.csvProfiles.list,
})

export const importsQuery = queryOptions({
  queryKey: ["imports"],
  queryFn: api.imports.list,
})

function fileKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`
}

export function importPreviewQuery(upload: ImportUpload) {
  return queryOptions({
    queryKey: ["imports", "preview", fileKey(upload.file), upload.profileId ?? null, upload.accountId ?? null],
    queryFn: () => api.imports.preview(upload),
    staleTime: Number.POSITIVE_INFINITY,
  })
}

export function transactionsQuery(filters: TransactionPageFilters) {
  return queryOptions({
    queryKey: ["transactions", filters],
    queryFn: () => api.transactions.list(filters),
    placeholderData: keepPreviousData,
  })
}

export const categoriesQuery = queryOptions({
  queryKey: ["categories"],
  queryFn: api.categories.list,
})

export const rulesQuery = queryOptions({
  queryKey: ["rules"],
  queryFn: api.rules.list,
})

export const fixedItemsQuery = queryOptions({
  queryKey: ["fixed-items"],
  queryFn: api.fixedItems.list,
})

export function fixedItemsOverviewQuery(from: string, to: string) {
  return queryOptions({
    queryKey: ["fixed-items", "overview", from, to],
    queryFn: () => api.fixedItems.overview(from, to),
  })
}

export function fixedItemTransactionsQuery(id: string) {
  return queryOptions({
    queryKey: ["fixed-items", "transactions", id],
    queryFn: () => api.fixedItems.transactions(id),
  })
}

export const budgetsQuery = queryOptions({
  queryKey: ["budgets"],
  queryFn: api.budgets.list,
})

export function budgetsOverviewQuery(date: string) {
  return queryOptions({
    queryKey: ["budgets", "overview", date],
    queryFn: () => api.budgets.overview(date),
    placeholderData: keepPreviousData,
  })
}

export function dashboardQuery(date: string) {
  return queryOptions({
    queryKey: ["dashboard", date],
    queryFn: () => api.dashboard.overview(date),
    placeholderData: keepPreviousData,
  })
}

export async function invalidateBudgetData(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: budgetsQuery.queryKey }),
    queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
  ])
}

export async function invalidateTransactionData(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["transactions"] }),
    queryClient.invalidateQueries({ queryKey: categoriesQuery.queryKey }),
    queryClient.invalidateQueries({ queryKey: fixedItemsQuery.queryKey }),
    invalidateBudgetData(queryClient),
  ])
}

export async function invalidateFixedItemData(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    invalidateTransactionData(queryClient),
    queryClient.invalidateQueries({ queryKey: rulesQuery.queryKey }),
  ])
}

export async function invalidateAfterImport(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["transactions"] }),
    queryClient.invalidateQueries({ queryKey: accountsQuery.queryKey }),
    queryClient.invalidateQueries({ queryKey: importsQuery.queryKey }),
    queryClient.invalidateQueries({ queryKey: categoriesQuery.queryKey }),
    queryClient.invalidateQueries({ queryKey: fixedItemsQuery.queryKey }),
    invalidateBudgetData(queryClient),
  ])
}
