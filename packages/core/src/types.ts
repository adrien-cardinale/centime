export type IsoDateTime = string
export type IsoDate = string

export type SyncColumns = {
  id: string
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
  deletedAt: IsoDateTime | null
}

export type AccountKind = "bank" | "card"
export type TransactionStatus = "booked" | "pending"
export type ImportFormat = "csv" | "camt053"
export type RuleMatchKind = "contains" | "regex"
export type RuleField = "raw_label" | "merchant" | "provider_category"
export type Periodicity = "monthly" | "quarterly" | "yearly"

export const ACCOUNT_KINDS = ["bank", "card"] as const satisfies readonly AccountKind[]
export const TRANSACTION_STATUSES = ["booked", "pending"] as const satisfies readonly TransactionStatus[]
export const IMPORT_FORMATS = ["csv", "camt053"] as const satisfies readonly ImportFormat[]
export const RULE_MATCH_KINDS = ["contains", "regex"] as const satisfies readonly RuleMatchKind[]
export const RULE_FIELDS = ["raw_label", "merchant", "provider_category"] as const satisfies readonly RuleField[]
export const PERIODICITIES = ["monthly", "quarterly", "yearly"] as const satisfies readonly Periodicity[]

export type Account = SyncColumns & {
  name: string
  kind: AccountKind
  identifier: string
  currency: string
}

export type Theme = SyncColumns & {
  name: string
  color: string
  icon: string | null
}

export type Category = SyncColumns & {
  name: string
  color: string
  icon: string | null
  themeId: string | null
}

export type Transaction = SyncColumns & {
  accountId: string
  bookingDate: IsoDate
  valueDate: IsoDate | null
  rawLabel: string
  merchant: string | null
  providerCategory: string | null
  amount: number
  currency: string
  status: TransactionStatus
  categoryId: string | null
  fixedItemId: string | null
  isTransfer: boolean
  importId: string | null
  sourceRef: string | null
  fingerprint: string
  balanceAfter: number | null
}

export type Import = SyncColumns & {
  fileName: string
  format: ImportFormat
  profileId: string | null
  importedAt: IsoDateTime
  insertedCount: number
  skippedCount: number
  updatedCount: number
}

export type Rule = SyncColumns & {
  pattern: string
  matchKind: RuleMatchKind
  field: RuleField
  categoryId: string | null
  fixedItemId: string | null
  markAsTransfer: boolean
  priority: number
}

export type FixedItem = SyncColumns & {
  name: string
  expectedAmount: number
  periodicity: Periodicity
  dueDay: number | null
  dueMonth: number | null
  categoryId: string | null
  startDate: IsoDate
  endDate: IsoDate | null
}

export type Budget = SyncColumns & {
  categoryId: string
  amount: number
  period: Periodicity
  rollover: boolean
  startDate: IsoDate
}
