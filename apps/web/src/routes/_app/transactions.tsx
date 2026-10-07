import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useState } from "react"
import { PageHeader } from "@/components/page-header"
import { BulkActionsBar } from "@/components/transactions/bulk-actions-bar"
import { ExportButton } from "@/components/transactions/export-button"
import { Pagination } from "@/components/transactions/pagination"
import { type TransactionFilterValues, TransactionFilters } from "@/components/transactions/transaction-filters"
import { TransactionsTable } from "@/components/transactions/transactions-table"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import type { TransactionsPage as TransactionsPageData } from "@/lib/api"
import { isIsoDate } from "@/lib/budgets"
import { accountsQuery, categoriesQuery, fixedItemsQuery, transactionsQuery } from "@/lib/queries"

const PAGE_SIZE = 50
const SEARCH_DEBOUNCE_MS = 300
type UrlFilterKey = "fixedItemId" | "categoryId" | "themeId" | "from" | "to"
type LocalFilterValues = Omit<TransactionFilterValues, UrlFilterKey>
type TransactionsSearch = Partial<Record<UrlFilterKey, string>>
type PageState = { searchKey: string; page: number; selectedIds: Set<string> }

const EMPTY_FILTERS: LocalFilterValues = {
  accountId: undefined,
  search: "",
  transfer: undefined,
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined
}

function validateTransactionsSearch(search: Record<string, unknown>): TransactionsSearch {
  const entries = {
    fixedItemId: nonEmptyString(search.fixedItemId),
    categoryId: nonEmptyString(search.categoryId),
    themeId: nonEmptyString(search.themeId),
    from: isIsoDate(search.from) ? search.from : undefined,
    to: isIsoDate(search.to) ? search.to : undefined,
  }
  return Object.fromEntries(Object.entries(entries).filter(([, value]) => value !== undefined))
}

function toSearch({ fixedItemId, categoryId, themeId, from, to }: TransactionFilterValues): TransactionsSearch {
  return validateTransactionsSearch({ fixedItemId, categoryId, themeId, from, to })
}

function toLocalFilters({ accountId, search, transfer }: TransactionFilterValues): LocalFilterValues {
  return { accountId, search, transfer }
}

function searchKeyOf(search: TransactionsSearch): string {
  return JSON.stringify([search.fixedItemId, search.categoryId, search.themeId, search.from, search.to])
}

export const Route = createFileRoute("/_app/transactions")({
  validateSearch: validateTransactionsSearch,
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.prefetchQuery(accountsQuery),
      context.queryClient.prefetchQuery(categoriesQuery),
      context.queryClient.prefetchQuery(fixedItemsQuery),
    ]),
  component: TransactionsPage,
})

function hasActiveFilters(filters: TransactionFilterValues): boolean {
  return Boolean(
    filters.accountId ||
      filters.from ||
      filters.to ||
      filters.search.trim() ||
      filters.categoryId ||
      filters.fixedItemId ||
      filters.transfer,
  )
}

function usePageState(searchKey: string) {
  const [state, setState] = useState<PageState>({ searchKey, page: 1, selectedIds: new Set() })
  const current = state.searchKey === searchKey ? state : { searchKey, page: 1, selectedIds: new Set<string>() }
  return {
    page: current.page,
    selectedIds: current.selectedIds,
    setPage: (page: number) => setState({ searchKey, page, selectedIds: new Set() }),
    setSelectedIds: (selectedIds: Set<string>) => setState({ ...current, selectedIds }),
  }
}

function TransactionsPage() {
  const urlFilters = Route.useSearch()
  const navigate = Route.useNavigate()
  const searchKey = searchKeyOf(urlFilters)
  const [localFilters, setLocalFilters] = useState(EMPTY_FILTERS)
  const { page, setPage, selectedIds, setSelectedIds } = usePageState(searchKey)
  const filters: TransactionFilterValues = {
    ...localFilters,
    fixedItemId: urlFilters.fixedItemId,
    categoryId: urlFilters.categoryId,
    themeId: urlFilters.themeId,
    from: urlFilters.from ?? "",
    to: urlFilters.to ?? "",
  }
  const search = useDebouncedValue(filters.search, SEARCH_DEBOUNCE_MS)
  const queryFilters = { ...filters, search }
  const { data, isPending, error } = useQuery(transactionsQuery({ ...queryFilters, page, pageSize: PAGE_SIZE }))

  const clearSelection = () => setSelectedIds(new Set())

  const changeFilters = (next: TransactionFilterValues) => {
    setLocalFilters(toLocalFilters(next))
    setPage(1)
    const nextSearch = toSearch(next)
    if (searchKeyOf(nextSearch) !== searchKey) void navigate({ search: nextSearch, replace: true })
  }

  const changePage = (next: number) => setPage(next)

  return (
    <div className="space-y-6">
      <PageHeader title="Transactions" description="Toutes les opérations importées, du plus récent au plus ancien." />
      <TransactionFilters
        values={filters}
        onChange={changeFilters}
        actions={<ExportButton filters={queryFilters} disabled={!data || data.total === 0} />}
      />
      {selectedIds.size > 0 && <BulkActionsBar selectedIds={[...selectedIds]} onClear={clearSelection} />}
      <Card className="py-0">
        <CardContent className="px-0">
          {isPending && <TransactionsSkeleton />}
          {error && <p className="p-6 text-sm text-destructive">{error.message}</p>}
          {data && (
            <TransactionsResult
              data={data}
              filtered={hasActiveFilters(filters)}
              onPageChange={changePage}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

type TransactionsResultProps = {
  data: TransactionsPageData
  filtered: boolean
  onPageChange: (page: number) => void
  selectedIds: ReadonlySet<string>
  onSelectionChange: (selectedIds: Set<string>) => void
}

function TransactionsResult({ data, filtered, onPageChange, selectedIds, onSelectionChange }: TransactionsResultProps) {
  if (data.total === 0) return filtered ? <NoMatch /> : <EmptyState />
  const pageCount = Math.max(1, Math.ceil(data.total / data.pageSize))
  return (
    <>
      <TransactionsTable items={data.items} selectedIds={selectedIds} onSelectionChange={onSelectionChange} />
      <Pagination page={data.page} pageCount={pageCount} onPageChange={onPageChange} />
    </>
  )
}

function NoMatch() {
  return <p className="p-6 text-center text-sm text-muted-foreground">Aucune transaction ne correspond à ces filtres.</p>
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 p-10 text-center">
      <p className="text-sm text-muted-foreground">Aucune transaction pour l'instant.</p>
      <Button asChild>
        <Link to="/import">Importer un relevé</Link>
      </Button>
    </div>
  )
}

function TransactionsSkeleton() {
  return (
    <div className="space-y-3 p-6">
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-5 w-2/3" />
    </div>
  )
}
