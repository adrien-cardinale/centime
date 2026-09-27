import type { BudgetPayload, CategoryInput, CsvProfileInput, FixedItemPayload, RuleMatcherInput, RulePayload } from "@centime/core"
import type { AppType } from "@centime/server"
import { hc, type InferRequestType, type InferResponseType } from "hono/client"

const apiBaseUrl: string = import.meta.env.VITE_API_URL ?? window.location.origin

const client = hc<AppType>(apiBaseUrl, { init: { credentials: "include" } })

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

type ApiResponse = { ok: boolean; status: number; text(): Promise<string> }
type SuccessResponse<R extends ApiResponse> = Extract<R, { ok: true }>

function isSuccess<R extends ApiResponse>(response: R): response is SuccessResponse<R> {
  return response.ok
}

function extractErrorMessage(body: string): string | null {
  try {
    const parsed: unknown = JSON.parse(body)
    if (parsed && typeof parsed === "object" && "error" in parsed && typeof parsed.error === "string") {
      return parsed.error
    }
  } catch {}
  return null
}

async function toApiError(response: ApiResponse): Promise<ApiError> {
  const message = extractErrorMessage(await response.text()) ?? `Erreur ${response.status}`
  return new ApiError(message, response.status)
}

async function successOrThrow<R extends ApiResponse>(call: Promise<R>): Promise<SuccessResponse<R>> {
  const response = await call
  if (!isSuccess(response)) throw await toApiError(response)
  return response
}

type AccountsEndpoint = typeof client.api.accounts
type CsvProfilesEndpoint = (typeof client.api)["csv-profiles"]
type ImportsEndpoint = typeof client.api.imports
type TransactionsEndpoint = typeof client.api.transactions
type CategoriesEndpoint = typeof client.api.categories
type RulesEndpoint = typeof client.api.rules
type FixedItemsEndpoint = (typeof client.api)["fixed-items"]
type BudgetsEndpoint = typeof client.api.budgets
type DashboardEndpoint = typeof client.api.dashboard

export type Account = InferResponseType<AccountsEndpoint["$get"], 200>[number]
export type CreateAccountInput = InferRequestType<AccountsEndpoint["$post"]>["json"]
export type CsvProfile = InferResponseType<CsvProfilesEndpoint["$get"], 200>[number]
export type ImportPreview = InferResponseType<ImportsEndpoint["preview"]["$post"], 200>
export type PreviewRow = ImportPreview["rows"][number]
export type RowState = PreviewRow["state"]
export type ImportOutcome = InferResponseType<ImportsEndpoint["$post"], 201>
export type ImportHistoryEntry = InferResponseType<ImportsEndpoint["$get"], 200>[number]
export type TransactionsPage = InferResponseType<TransactionsEndpoint["$get"], 200>
export type TransactionItem = TransactionsPage["items"][number]
export type Category = InferResponseType<CategoriesEndpoint["$get"], 200>[number]
export type Rule = InferResponseType<RulesEndpoint["$get"], 200>[number]
export type RuleTestResult = InferResponseType<RulesEndpoint["test"]["$post"], 200>
export type ApplyRulesScope = InferRequestType<RulesEndpoint["apply"]["$post"]>["json"]["scope"]
export type ApplyRulesResult = InferResponseType<RulesEndpoint["apply"]["$post"], 200>

export type FixedItem = InferResponseType<FixedItemsEndpoint["$get"], 200>[number]
export type FixedItemsOverview = InferResponseType<FixedItemsEndpoint["overview"]["$get"], 200>
export type FixedItemOverview = FixedItemsOverview["items"][number]
export type OccurrenceReport = FixedItemOverview["occurrences"][number]
export type FixedItemTransaction = InferResponseType<FixedItemsEndpoint[":id"]["transactions"]["$get"], 200>[number]

export type Budget = InferResponseType<BudgetsEndpoint["$get"], 200>[number]
export type BudgetsOverview = InferResponseType<BudgetsEndpoint["overview"]["$get"], 200>
export type BudgetOverviewItem = BudgetsOverview["budgets"][number]
export type BudgetTotals = BudgetsOverview["totals"]["monthly"]
export type UnbudgetedCategory = BudgetsOverview["unbudgeted"][number]

export type DashboardOverview = InferResponseType<DashboardEndpoint["$get"], 200>
export type DashboardKpis = DashboardOverview["kpis"]
export type MonthlyPoint = DashboardOverview["monthlySeries"][number]
export type CategoryBreakdownEntry = DashboardOverview["categoryBreakdown"][number]
export type BalancePoint = DashboardOverview["balanceSeries"][number]
export type UpcomingOccurrence = DashboardOverview["upcomingOccurrences"][number]

export const UNCATEGORIZED_FILTER = "none"
export const WITHOUT_FIXED_ITEM_FILTER = "none"

export type TransferFilter = "only" | "hide"

export type TransactionChanges = {
  categoryId?: string | null
  isTransfer?: boolean
  fixedItemId?: string | null
}

export type ImportUpload = {
  file: File
  profileId?: string | undefined
  accountId?: string | undefined
}

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

function transferQuery(transfer: TransferFilter | undefined): "true" | "false" | undefined {
  if (transfer === undefined) return undefined
  return transfer === "only" ? "true" : "false"
}

function flagQuery(value: boolean | undefined): "true" | undefined {
  return value ? "true" : undefined
}

function toFilterQuery(filters: TransactionFilters) {
  return {
    accountId: filters.accountId || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
    search: filters.search?.trim() || undefined,
    categoryId: filters.categoryId || undefined,
    includeChildren: filters.categoryId ? flagQuery(filters.includeChildren) : undefined,
    fixedItemId: filters.fixedItemId || undefined,
    isTransfer: transferQuery(filters.transfer),
  }
}

function toPageQuery(filters: TransactionPageFilters) {
  return { ...toFilterQuery(filters), page: String(filters.page), pageSize: String(filters.pageSize) }
}

function withoutEmptyValues(query: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(query).flatMap(([key, value]) => (value === undefined ? [] : [[key, value]])),
  )
}

export const api = {
  auth: {
    me: async () => (await successOrThrow(client.api.auth.me.$get())).json(),
    login: async (password: string) => (await successOrThrow(client.api.auth.login.$post({ json: { password } }))).json(),
    logout: async () => (await successOrThrow(client.api.auth.logout.$post())).json(),
  },
  accounts: {
    list: async () => (await successOrThrow(client.api.accounts.$get())).json(),
    create: async (input: CreateAccountInput) =>
      (await successOrThrow(client.api.accounts.$post({ json: input }))).json(),
  },
  csvProfiles: {
    list: async () => (await successOrThrow(client.api["csv-profiles"].$get())).json(),
    create: async (input: CsvProfileInput) =>
      (await successOrThrow(client.api["csv-profiles"].$post({ json: input }))).json(),
    update: async (id: string, input: CsvProfileInput) =>
      (await successOrThrow(client.api["csv-profiles"][":id"].$put({ param: { id }, json: input }))).json(),
    remove: async (id: string) =>
      (await successOrThrow(client.api["csv-profiles"][":id"].$delete({ param: { id } }))).json(),
  },
  imports: {
    list: async () => (await successOrThrow(client.api.imports.$get())).json(),
    preview: async (upload: ImportUpload) =>
      (await successOrThrow(client.api.imports.preview.$post({ form: upload }))).json(),
    commit: async (upload: ImportUpload) => (await successOrThrow(client.api.imports.$post({ form: upload }))).json(),
  },
  transactions: {
    list: async (filters: TransactionPageFilters) =>
      (await successOrThrow(client.api.transactions.$get({ query: toPageQuery(filters) }))).json(),
    exportUrl: (filters: TransactionFilters) =>
      client.api.transactions.export.$url({ query: withoutEmptyValues(toFilterQuery(filters)) }).toString(),
    update: async (id: string, changes: TransactionChanges) =>
      (await successOrThrow(client.api.transactions[":id"].$patch({ param: { id }, json: changes }))).json(),
    bulkUpdate: async (ids: string[], changes: TransactionChanges) =>
      (await successOrThrow(client.api.transactions.$patch({ json: { ids, ...changes } }))).json(),
  },
  categories: {
    list: async () => (await successOrThrow(client.api.categories.$get())).json(),
    create: async (input: CategoryInput) => (await successOrThrow(client.api.categories.$post({ json: input }))).json(),
    update: async (id: string, input: CategoryInput) =>
      (await successOrThrow(client.api.categories[":id"].$put({ param: { id }, json: input }))).json(),
    remove: async (id: string) =>
      (await successOrThrow(client.api.categories[":id"].$delete({ param: { id } }))).json(),
  },
  rules: {
    list: async () => (await successOrThrow(client.api.rules.$get())).json(),
    create: async (input: RulePayload) => (await successOrThrow(client.api.rules.$post({ json: input }))).json(),
    update: async (id: string, input: RulePayload) =>
      (await successOrThrow(client.api.rules[":id"].$put({ param: { id }, json: input }))).json(),
    remove: async (id: string) => (await successOrThrow(client.api.rules[":id"].$delete({ param: { id } }))).json(),
    test: async (matcher: RuleMatcherInput) =>
      (await successOrThrow(client.api.rules.test.$post({ json: matcher }))).json(),
    apply: async (scope: ApplyRulesScope) =>
      (await successOrThrow(client.api.rules.apply.$post({ json: { scope } }))).json(),
  },
  fixedItems: {
    list: async () => (await successOrThrow(client.api["fixed-items"].$get())).json(),
    create: async (input: FixedItemPayload) =>
      (await successOrThrow(client.api["fixed-items"].$post({ json: input }))).json(),
    update: async (id: string, input: FixedItemPayload) =>
      (await successOrThrow(client.api["fixed-items"][":id"].$put({ param: { id }, json: input }))).json(),
    remove: async (id: string) =>
      (await successOrThrow(client.api["fixed-items"][":id"].$delete({ param: { id } }))).json(),
    overview: async (from: string, to: string) =>
      (await successOrThrow(client.api["fixed-items"].overview.$get({ query: { from, to } }))).json(),
    transactions: async (id: string) =>
      (await successOrThrow(client.api["fixed-items"][":id"].transactions.$get({ param: { id } }))).json(),
  },
  budgets: {
    list: async () => (await successOrThrow(client.api.budgets.$get())).json(),
    create: async (input: BudgetPayload) => (await successOrThrow(client.api.budgets.$post({ json: input }))).json(),
    update: async (id: string, input: BudgetPayload) =>
      (await successOrThrow(client.api.budgets[":id"].$put({ param: { id }, json: input }))).json(),
    remove: async (id: string) => (await successOrThrow(client.api.budgets[":id"].$delete({ param: { id } }))).json(),
    overview: async (date: string) =>
      (await successOrThrow(client.api.budgets.overview.$get({ query: { date } }))).json(),
  },
  dashboard: {
    overview: async (date: string) => (await successOrThrow(client.api.dashboard.$get({ query: { date } }))).json(),
  },
}
