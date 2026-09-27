import { ACCOUNT_KINDS, IMPORT_FORMATS, PERIODICITIES, RULE_FIELDS, RULE_MATCH_KINDS, TRANSACTION_STATUSES } from "@centime/core"
import { type AnySQLiteColumn, index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

const nowIso = () => new Date().toISOString()

const syncColumns = {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  createdAt: text("created_at").notNull().$defaultFn(nowIso),
  updatedAt: text("updated_at").notNull().$defaultFn(nowIso).$onUpdateFn(nowIso),
  deletedAt: text("deleted_at"),
}

export const accounts = sqliteTable("accounts", {
  ...syncColumns,
  name: text("name").notNull(),
  kind: text("kind", { enum: ACCOUNT_KINDS }).notNull(),
  identifier: text("identifier").notNull().unique(),
  currency: text("currency").notNull().default("CHF"),
})

export const categories = sqliteTable("categories", {
  ...syncColumns,
  name: text("name").notNull(),
  color: text("color").notNull(),
  icon: text("icon"),
  parentId: text("parent_id").references((): AnySQLiteColumn => categories.id),
})

export const csvProfiles = sqliteTable("csv_profiles", {
  ...syncColumns,
  name: text("name").notNull(),
  config: text("config").notNull(),
})

export const imports = sqliteTable("imports", {
  ...syncColumns,
  fileName: text("file_name").notNull(),
  format: text("format", { enum: IMPORT_FORMATS }).notNull(),
  profileId: text("profile_id").references(() => csvProfiles.id),
  importedAt: text("imported_at").notNull().$defaultFn(nowIso),
  insertedCount: integer("inserted_count").notNull().default(0),
  skippedCount: integer("skipped_count").notNull().default(0),
  updatedCount: integer("updated_count").notNull().default(0),
})

export const fixedItems = sqliteTable("fixed_items", {
  ...syncColumns,
  name: text("name").notNull(),
  expectedAmount: real("expected_amount").notNull(),
  periodicity: text("periodicity", { enum: PERIODICITIES }).notNull(),
  dueDay: integer("due_day"),
  dueMonth: integer("due_month"),
  categoryId: text("category_id").references(() => categories.id),
  startDate: text("start_date").notNull(),
  endDate: text("end_date"),
})

export const transactions = sqliteTable(
  "transactions",
  {
    ...syncColumns,
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id),
    bookingDate: text("booking_date").notNull(),
    valueDate: text("value_date"),
    rawLabel: text("raw_label").notNull(),
    merchant: text("merchant"),
    providerCategory: text("provider_category"),
    amount: real("amount").notNull(),
    currency: text("currency").notNull(),
    status: text("status", { enum: TRANSACTION_STATUSES }).notNull(),
    categoryId: text("category_id").references(() => categories.id),
    fixedItemId: text("fixed_item_id").references(() => fixedItems.id),
    isTransfer: integer("is_transfer", { mode: "boolean" }).notNull().default(false),
    importId: text("import_id").references(() => imports.id),
    sourceRef: text("source_ref"),
    fingerprint: text("fingerprint").notNull(),
    balanceAfter: real("balance_after"),
  },
  (table) => [
    index("transactions_account_id_idx").on(table.accountId),
    index("transactions_booking_date_idx").on(table.bookingDate),
    index("transactions_category_id_idx").on(table.categoryId),
    uniqueIndex("transactions_fingerprint_idx").on(table.fingerprint),
  ],
)

export const rules = sqliteTable("rules", {
  ...syncColumns,
  pattern: text("pattern").notNull(),
  matchKind: text("match_kind", { enum: RULE_MATCH_KINDS }).notNull(),
  field: text("field", { enum: RULE_FIELDS }).notNull(),
  categoryId: text("category_id").references(() => categories.id),
  fixedItemId: text("fixed_item_id").references(() => fixedItems.id),
  markAsTransfer: integer("mark_as_transfer", { mode: "boolean" }).notNull().default(false),
  priority: integer("priority").notNull().default(0),
})

export const budgets = sqliteTable("budgets", {
  ...syncColumns,
  categoryId: text("category_id")
    .notNull()
    .references(() => categories.id),
  amount: real("amount").notNull(),
  period: text("period", { enum: PERIODICITIES }).notNull(),
  rollover: integer("rollover", { mode: "boolean" }).notNull().default(false),
  startDate: text("start_date").notNull(),
})

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(nowIso),
})

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
})

export type AccountRow = typeof accounts.$inferSelect
export type NewAccountRow = typeof accounts.$inferInsert
export type CategoryRow = typeof categories.$inferSelect
export type NewCategoryRow = typeof categories.$inferInsert
export type TransactionRow = typeof transactions.$inferSelect
export type NewTransactionRow = typeof transactions.$inferInsert
export type ImportRow = typeof imports.$inferSelect
export type NewImportRow = typeof imports.$inferInsert
export type CsvProfileRow = typeof csvProfiles.$inferSelect
export type NewCsvProfileRow = typeof csvProfiles.$inferInsert
export type RuleRow = typeof rules.$inferSelect
export type NewRuleRow = typeof rules.$inferInsert
export type FixedItemRow = typeof fixedItems.$inferSelect
export type NewFixedItemRow = typeof fixedItems.$inferInsert
export type BudgetRow = typeof budgets.$inferSelect
export type NewBudgetRow = typeof budgets.$inferInsert
export type SessionRow = typeof sessions.$inferSelect
export type NewSessionRow = typeof sessions.$inferInsert
export type SettingRow = typeof settings.$inferSelect
export type NewSettingRow = typeof settings.$inferInsert
