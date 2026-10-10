import type {
  BudgetPayload,
  CategoryInput,
  CsvProfileInput,
  FixedItemPayload,
  ManualTransactionInput,
  RuleMatcherInput,
  RulePayload,
  ThemeInput,
  TransactionSplitInput,
} from "@centime/core"
import type { accountInputSchema, apiSurface, applyRulesInputSchema } from "@centime/services"
import type { z } from "zod"
import type { TransactionFilters, TransactionPageFilters } from "./filters"
import type { ImportUpload, TransactionChanges } from "./inputs"

type Surface = typeof apiSurface
type Out<Call extends (...args: never[]) => Promise<unknown>> = Promise<Awaited<ReturnType<Call>>>
type AccountInput = z.input<typeof accountInputSchema>
type ApplyScopeInput = z.input<typeof applyRulesInputSchema>["scope"]

export type Api = {
  accounts: {
    list(): Out<Surface["accounts"]["list"]>
    create(input: AccountInput): Out<Surface["accounts"]["create"]>
  }
  csvProfiles: {
    list(): Out<Surface["csvProfiles"]["list"]>
    create(input: CsvProfileInput): Out<Surface["csvProfiles"]["create"]>
    update(id: string, input: CsvProfileInput): Out<Surface["csvProfiles"]["update"]>
    remove(id: string): Out<Surface["csvProfiles"]["remove"]>
  }
  imports: {
    list(): Out<Surface["imports"]["list"]>
    preview(upload: ImportUpload): Out<Surface["imports"]["preview"]>
    commit(upload: ImportUpload): Out<Surface["imports"]["commit"]>
    remove(id: string): Out<Surface["imports"]["remove"]>
  }
  transactions: {
    create(input: ManualTransactionInput): Out<Surface["transactions"]["create"]>
    list(filters: TransactionPageFilters): Out<Surface["transactions"]["list"]>
    export(filters: TransactionFilters): Promise<Blob>
    update(id: string, changes: TransactionChanges): Out<Surface["transactions"]["update"]>
    bulkUpdate(ids: string[], changes: TransactionChanges): Out<Surface["transactions"]["bulkUpdate"]>
    split(input: TransactionSplitInput): Out<Surface["transactions"]["split"]>
    unsplit(transactionId: string): Out<Surface["transactions"]["unsplit"]>
  }
  themes: {
    list(): Out<Surface["themes"]["list"]>
    create(input: ThemeInput): Out<Surface["themes"]["create"]>
    update(id: string, input: ThemeInput): Out<Surface["themes"]["update"]>
    remove(id: string): Out<Surface["themes"]["remove"]>
  }
  categories: {
    list(): Out<Surface["categories"]["list"]>
    create(input: CategoryInput): Out<Surface["categories"]["create"]>
    update(id: string, input: CategoryInput): Out<Surface["categories"]["update"]>
    remove(id: string): Out<Surface["categories"]["remove"]>
  }
  rules: {
    list(): Out<Surface["rules"]["list"]>
    create(input: RulePayload): Out<Surface["rules"]["create"]>
    update(id: string, input: RulePayload): Out<Surface["rules"]["update"]>
    remove(id: string): Out<Surface["rules"]["remove"]>
    test(matcher: RuleMatcherInput): Out<Surface["rules"]["test"]>
    apply(scope: ApplyScopeInput): Out<Surface["rules"]["apply"]>
  }
  fixedItems: {
    list(): Out<Surface["fixedItems"]["list"]>
    create(input: FixedItemPayload): Out<Surface["fixedItems"]["create"]>
    update(id: string, input: FixedItemPayload): Out<Surface["fixedItems"]["update"]>
    remove(id: string): Out<Surface["fixedItems"]["remove"]>
    overview(from: string, to: string): Out<Surface["fixedItems"]["overview"]>
    transactions(id: string): Out<Surface["fixedItems"]["transactions"]>
  }
  budgets: {
    list(): Out<Surface["budgets"]["list"]>
    create(input: BudgetPayload): Out<Surface["budgets"]["create"]>
    update(id: string, input: BudgetPayload): Out<Surface["budgets"]["update"]>
    remove(id: string): Out<Surface["budgets"]["remove"]>
    overview(date: string): Out<Surface["budgets"]["overview"]>
  }
  dashboard: {
    overview(date: string): Out<Surface["dashboard"]["overview"]>
  }
}

type Result<Call extends (...args: never[]) => Promise<unknown>> = Awaited<ReturnType<Call>>

export type Account = Result<Api["accounts"]["list"]>[number]
export type CreateAccountInput = Parameters<Api["accounts"]["create"]>[0]
export type CsvProfile = Result<Api["csvProfiles"]["list"]>[number]
export type ImportPreview = Result<Api["imports"]["preview"]>
export type PreviewRow = ImportPreview["rows"][number]
export type RowState = PreviewRow["state"]
export type ImportOutcome = Result<Api["imports"]["commit"]>
export type ImportHistoryEntry = Result<Api["imports"]["list"]>[number]
export type TransactionsPage = Result<Api["transactions"]["list"]>
export type TransactionItem = TransactionsPage["items"][number]
export type Theme = Result<Api["themes"]["list"]>[number]
export type Category = Result<Api["categories"]["list"]>[number]
export type Rule = Result<Api["rules"]["list"]>[number]
export type RuleTestResult = Result<Api["rules"]["test"]>
export type ApplyRulesScope = Parameters<Api["rules"]["apply"]>[0]
export type ApplyRulesResult = Result<Api["rules"]["apply"]>

export type FixedItem = Result<Api["fixedItems"]["list"]>[number]
export type FixedItemsOverview = Result<Api["fixedItems"]["overview"]>
export type FixedItemOverview = FixedItemsOverview["items"][number]
export type OccurrenceReport = FixedItemOverview["occurrences"][number]
export type FixedItemTransaction = Result<Api["fixedItems"]["transactions"]>[number]

export type Budget = Result<Api["budgets"]["list"]>[number]
export type BudgetsOverview = Result<Api["budgets"]["overview"]>
export type BudgetOverviewItem = BudgetsOverview["budgets"][number]
export type BudgetTotals = BudgetsOverview["totals"]["monthly"]
export type UnbudgetedCategory = BudgetsOverview["unbudgeted"][number]

export type DashboardOverview = Result<Api["dashboard"]["overview"]>
export type DashboardKpis = DashboardOverview["kpis"]
export type MonthlyPoint = DashboardOverview["monthlySeries"][number]
export type CategoryBreakdownEntry = DashboardOverview["categoryBreakdown"][number]
export type BalancePoint = DashboardOverview["balanceSeries"][number]
export type UpcomingOccurrence = DashboardOverview["upcomingOccurrences"][number]
