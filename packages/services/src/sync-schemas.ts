import {
  ACCOUNT_KINDS,
  IMPORT_FORMATS,
  isoDateSchema,
  PERIODICITIES,
  RECEIPT_STATUSES,
  RULE_FIELDS,
  RULE_MATCH_KINDS,
  TRANSACTION_STATUSES,
} from "@centime/core"
import type { SyncTableEntry, SyncTableName } from "@centime/db"
import { z } from "zod"

type RowOf<Name extends SyncTableName> = Extract<SyncTableEntry, { name: Name }>["table"]["$inferSelect"]

export type PushedRow<Name extends SyncTableName> = Omit<RowOf<Name>, "syncVersion"> & {
  syncVersion?: number | null | undefined
}

export type PushedChanges = { [Name in SyncTableName]?: PushedRow<Name>[] }

type SyncRowSchemas = { [Name in SyncTableName]: z.ZodType<PushedRow<Name>> }

const isoDateTime = z.iso.datetime()
const reference = z.uuid().nullable()

const syncFields = {
  id: z.uuid(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
  deletedAt: isoDateTime.nullable(),
  syncVersion: z.number().int().nullable().optional(),
}

// z.object (et non strictObject) : une colonne ajoutée par une version plus récente de l'app est
// ignorée au lieu de rendre la ligne — et donc toute la synchronisation — illisible pour ce client.
export const SYNC_ROW_SCHEMAS: SyncRowSchemas = {
  accounts: z.object({
    ...syncFields,
    name: z.string(),
    kind: z.enum(ACCOUNT_KINDS),
    identifier: z.string().min(1),
    currency: z.string(),
  }),
  themes: z.object({
    ...syncFields,
    name: z.string(),
    color: z.string(),
    icon: z.string().nullable(),
  }),
  categories: z.object({
    ...syncFields,
    name: z.string(),
    color: z.string(),
    icon: z.string().nullable(),
    themeId: reference,
  }),
  csv_profiles: z.object({
    ...syncFields,
    name: z.string(),
    config: z.string(),
  }),
  imports: z.object({
    ...syncFields,
    fileName: z.string(),
    format: z.enum(IMPORT_FORMATS),
    profileId: reference,
    importedAt: isoDateTime,
    insertedCount: z.number().int(),
    skippedCount: z.number().int(),
    updatedCount: z.number().int(),
  }),
  fixed_items: z.object({
    ...syncFields,
    name: z.string(),
    expectedAmount: z.number(),
    periodicity: z.enum(PERIODICITIES),
    dueDay: z.number().int().nullable(),
    dueMonth: z.number().int().nullable(),
    categoryId: reference,
    startDate: isoDateSchema,
    endDate: isoDateSchema.nullable(),
  }),
  rules: z.object({
    ...syncFields,
    pattern: z.string(),
    matchKind: z.enum(RULE_MATCH_KINDS),
    field: z.enum(RULE_FIELDS),
    categoryId: reference,
    fixedItemId: reference,
    markAsTransfer: z.boolean(),
    priority: z.number().int(),
  }),
  budgets: z.object({
    ...syncFields,
    categoryId: z.uuid(),
    amount: z.number(),
    period: z.enum(PERIODICITIES),
    rollover: z.boolean(),
    startDate: isoDateSchema,
  }),
  transactions: z.object({
    ...syncFields,
    accountId: z.uuid(),
    bookingDate: isoDateSchema,
    valueDate: isoDateSchema.nullable(),
    rawLabel: z.string(),
    merchant: z.string().nullable(),
    providerCategory: z.string().nullable(),
    amount: z.number(),
    currency: z.string(),
    status: z.enum(TRANSACTION_STATUSES),
    categoryId: reference,
    fixedItemId: reference,
    isTransfer: z.boolean(),
    isSplit: z.boolean().default(false),
    importId: reference,
    sourceRef: z.string().nullable(),
    fingerprint: z.string().min(1),
    balanceAfter: z.number().nullable(),
  }),
  transaction_splits: z.object({
    ...syncFields,
    transactionId: z.uuid(),
    categoryId: reference,
    amount: z.number(),
    note: z.string().nullable(),
    position: z.number().int(),
  }),
  receipts: z.object({
    ...syncFields,
    accountId: z.uuid(),
    transactionId: reference,
    capturedAt: isoDateTime,
    mime: z.string(),
    size: z.number().int(),
    sha256: z.string(),
    merchant: z.string().nullable(),
    total: z.number().nullable(),
    receiptDate: isoDateSchema.nullable(),
    note: z.string().nullable(),
    linesJson: z.string().nullable(),
    status: z.enum(RECEIPT_STATUSES),
  }),
}
