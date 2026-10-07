import {
  ACCOUNT_KINDS,
  IMPORT_FORMATS,
  isoDateSchema,
  PERIODICITIES,
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

export const SYNC_ROW_SCHEMAS: SyncRowSchemas = {
  accounts: z.strictObject({
    ...syncFields,
    name: z.string(),
    kind: z.enum(ACCOUNT_KINDS),
    identifier: z.string().min(1),
    currency: z.string(),
  }),
  themes: z.strictObject({
    ...syncFields,
    name: z.string(),
    color: z.string(),
    icon: z.string().nullable(),
  }),
  categories: z.strictObject({
    ...syncFields,
    name: z.string(),
    color: z.string(),
    icon: z.string().nullable(),
    themeId: reference,
  }),
  csv_profiles: z.strictObject({
    ...syncFields,
    name: z.string(),
    config: z.string(),
  }),
  imports: z.strictObject({
    ...syncFields,
    fileName: z.string(),
    format: z.enum(IMPORT_FORMATS),
    profileId: reference,
    importedAt: isoDateTime,
    insertedCount: z.number().int(),
    skippedCount: z.number().int(),
    updatedCount: z.number().int(),
  }),
  fixed_items: z.strictObject({
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
  rules: z.strictObject({
    ...syncFields,
    pattern: z.string(),
    matchKind: z.enum(RULE_MATCH_KINDS),
    field: z.enum(RULE_FIELDS),
    categoryId: reference,
    fixedItemId: reference,
    markAsTransfer: z.boolean(),
    priority: z.number().int(),
  }),
  budgets: z.strictObject({
    ...syncFields,
    categoryId: z.uuid(),
    amount: z.number(),
    period: z.enum(PERIODICITIES),
    rollover: z.boolean(),
    startDate: isoDateSchema,
  }),
  transactions: z.strictObject({
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
    importId: reference,
    sourceRef: z.string().nullable(),
    fingerprint: z.string().min(1),
    balanceAfter: z.number().nullable(),
  }),
}
