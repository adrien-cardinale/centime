import type { BudgetPayload, CategoryInput, CsvProfileInput, FixedItemPayload, RuleMatcherInput, RulePayload } from "@centime/core"
import type { AppType } from "@centime/server"
import { hc, type InferRequestType } from "hono/client"
import { ApiError } from "./errors"
import { normalizeTransactionFilter, type TransactionFilters, type TransactionPageFilters } from "./filters"
import type { ImportUpload, TransactionChanges } from "./inputs"

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

function flagQuery(value: boolean | undefined): "true" | "false" | undefined {
  if (value === undefined) return undefined
  return value ? "true" : "false"
}

function toFilterQuery(filters: TransactionFilters): Record<string, string> {
  const normalized = normalizeTransactionFilter(filters)
  const query = {
    ...normalized,
    includeChildren: flagQuery(normalized.includeChildren),
    isTransfer: flagQuery(normalized.isTransfer),
  }
  return Object.fromEntries(Object.entries(query).flatMap(([key, value]) => (value === undefined ? [] : [[key, value]])))
}

function toPageQuery(filters: TransactionPageFilters) {
  return { ...toFilterQuery(filters), page: String(filters.page), pageSize: String(filters.pageSize) }
}

function createClient() {
  const apiBaseUrl: string = import.meta.env.VITE_API_URL ?? window.location.origin
  return hc<AppType>(apiBaseUrl, { init: { credentials: "include" } })
}

type Client = ReturnType<typeof createClient>
type CreateAccountBody = InferRequestType<Client["api"]["accounts"]["$post"]>["json"]
type ApplyRulesBody = InferRequestType<Client["api"]["rules"]["apply"]["$post"]>["json"]

export function createHttpApi() {
  const client = createClient()
  return {
    auth: {
      me: async () => (await successOrThrow(client.api.auth.me.$get())).json(),
      login: async (password: string) =>
        (await successOrThrow(client.api.auth.login.$post({ json: { password } }))).json(),
      logout: async () => (await successOrThrow(client.api.auth.logout.$post())).json(),
      token: async (password: string, label: string) =>
        (await successOrThrow(client.api.auth.token.$post({ json: { password, label } }))).json(),
      tokens: async () => (await successOrThrow(client.api.auth.tokens.$get())).json(),
      revokeToken: async (id: string) =>
        (await successOrThrow(client.api.auth.tokens[":id"].$delete({ param: { id } }))).json(),
    },
    accounts: {
      list: async () => (await successOrThrow(client.api.accounts.$get())).json(),
      create: async (input: CreateAccountBody) =>
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
      commit: async (upload: ImportUpload) =>
        (await successOrThrow(client.api.imports.$post({ form: upload }))).json(),
      remove: async (id: string) => (await successOrThrow(client.api.imports[":id"].$delete({ param: { id } }))).json(),
    },
    transactions: {
      list: async (filters: TransactionPageFilters) =>
        (await successOrThrow(client.api.transactions.$get({ query: toPageQuery(filters) }))).json(),
      export: async (filters: TransactionFilters): Promise<Blob> =>
        (await successOrThrow(client.api.transactions.export.$get({ query: toFilterQuery(filters) }))).blob(),
      update: async (id: string, changes: TransactionChanges) =>
        (await successOrThrow(client.api.transactions[":id"].$patch({ param: { id }, json: changes }))).json(),
      bulkUpdate: async (ids: string[], changes: TransactionChanges) =>
        (await successOrThrow(client.api.transactions.$patch({ json: { ids, ...changes } }))).json(),
    },
    categories: {
      list: async () => (await successOrThrow(client.api.categories.$get())).json(),
      create: async (input: CategoryInput) =>
        (await successOrThrow(client.api.categories.$post({ json: input }))).json(),
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
      remove: async (id: string) =>
        (await successOrThrow(client.api.rules[":id"].$delete({ param: { id } }))).json(),
      test: async (matcher: RuleMatcherInput) =>
        (await successOrThrow(client.api.rules.test.$post({ json: matcher }))).json(),
      apply: async (scope: ApplyRulesBody["scope"]) =>
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
      create: async (input: BudgetPayload) =>
        (await successOrThrow(client.api.budgets.$post({ json: input }))).json(),
      update: async (id: string, input: BudgetPayload) =>
        (await successOrThrow(client.api.budgets[":id"].$put({ param: { id }, json: input }))).json(),
      remove: async (id: string) =>
        (await successOrThrow(client.api.budgets[":id"].$delete({ param: { id } }))).json(),
      overview: async (date: string) =>
        (await successOrThrow(client.api.budgets.overview.$get({ query: { date } }))).json(),
    },
    dashboard: {
      overview: async (date: string) =>
        (await successOrThrow(client.api.dashboard.$get({ query: { date } }))).json(),
    },
  }
}
