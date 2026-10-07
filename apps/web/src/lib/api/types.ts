import type { createHttpApi } from "./http"

export type Api = ReturnType<typeof createHttpApi>

type Result<Call extends (...args: never[]) => Promise<unknown>> = Awaited<ReturnType<Call>>

export type AuthStatus = Result<Api["auth"]["me"]>
export type CreatedApiToken = Result<Api["auth"]["token"]>
export type ApiToken = Result<Api["auth"]["tokens"]>[number]

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
