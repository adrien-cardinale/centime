import {
  budgetPayloadSchema,
  categoryInputSchema,
  csvProfileSchema,
  fixedItemPayloadSchema,
  manualTransactionSchema,
  type ReceiptCreate,
  receiptCreateSchema,
  receiptFilterSchema,
  receiptLinkSchema,
  receiptUpdateSchema,
  ruleMatcherSchema,
  rulePayloadSchema,
  themeInputSchema,
  transactionSplitSchema,
  transactionUnsplitSchema,
} from "@centime/core"
import type { Db } from "@centime/db"
import {
  accountInputSchema,
  apiSurface,
  applyRulesInputSchema,
  bulkTransactionUpdateSchema,
  type ImportSource,
  ServiceError,
  transactionChangesSchema,
} from "@centime/services"
import { z } from "zod"
import type { Vault } from "@/lib/crypto/envelope"
import { setLocalDatabase } from "@/lib/local-db/current-database"
import { type LocalDatabase, openLocalDb } from "@/lib/local-db/open-local-db"
import { isPreparedReceiptImage, type PreparedReceiptImage, prepareReceiptImage } from "@/lib/receipts/prepare-image"
import { deleteReceiptImage, moveReceiptImage, saveReceiptImage } from "@/lib/receipts/receipt-store"
import { ApiError } from "./errors"
import { normalizeTransactionFilter, type TransactionFilters } from "./filters"
import type { ImportUpload, ReceiptFileUpload } from "./inputs"
import type { Api } from "./types"

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
const UPLOAD_TOO_LARGE = "Fichier trop volumineux (10 Mo maximum)"
const INVALID_REQUEST = "Requête invalide"
const CSV_MIME_TYPE = "text/csv;charset=utf-8"

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide (AAAA-MM-JJ)")
const optionalIsoDate = isoDate.optional()
const pageSchema = z.object({
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(200),
})
const idSchema = z.string().min(1, INVALID_REQUEST)
const candidateOptionsSchema = z.object({
  amountTolerance: z.number().min(0).max(1000).optional(),
  dayTolerance: z.number().int().min(0).max(60).optional(),
})

function parseInput<Schema extends z.ZodType>(schema: Schema, value: unknown): z.output<Schema> {
  const parsed = schema.safeParse(value)
  if (parsed.success) return parsed.data
  throw new ApiError(parsed.error.issues[0]?.message ?? INVALID_REQUEST, 400)
}

function toApiError(error: unknown): unknown {
  if (error instanceof ApiError) return error
  if (error instanceof ServiceError) return new ApiError(error.message, error.status)
  console.error(error)
  return new ApiError(error instanceof Error ? error.message : "Erreur interne", 500)
}

function validatedFilter(filters: TransactionFilters) {
  const filter = normalizeTransactionFilter(filters)
  parseInput(optionalIsoDate, filter.from)
  parseInput(optionalIsoDate, filter.to)
  return filter
}

async function toImportSource(upload: ImportUpload): Promise<ImportSource> {
  if (!(upload.file instanceof File)) throw new ApiError("Fichier manquant ou invalide", 400)
  if (upload.file.size > MAX_UPLOAD_BYTES) throw new ApiError(UPLOAD_TOO_LARGE, 400)
  return {
    bytes: new Uint8Array(await upload.file.arrayBuffer()),
    fileName: upload.file.name,
    profileId: upload.profileId || undefined,
    accountId: upload.accountId || undefined,
  }
}

async function toPreparedImage(file: ReceiptFileUpload["file"]): Promise<PreparedReceiptImage> {
  if (isPreparedReceiptImage(file)) return file
  if (!(file instanceof File)) throw new ApiError("Fichier manquant ou invalide", 400)
  try {
    return await prepareReceiptImage(file)
  } catch (error) {
    throw new ApiError(error instanceof Error ? error.message : INVALID_REQUEST, 400)
  }
}

function receiptRowInput({ file: _file, ...details }: ReceiptFileUpload, image: PreparedReceiptImage) {
  return parseInput(receiptCreateSchema, {
    ...details,
    mime: image.mime,
    size: image.bytes.byteLength,
    sha256: image.sha256,
  })
}

async function discardImage(id: string): Promise<void> {
  await deleteReceiptImage(id).catch((error: unknown) => console.error("Suppression de l'image impossible", error))
}

async function insertReceiptRow(db: Db, input: ReceiptCreate, stagingId: string) {
  try {
    return await apiSurface.receipts.create(db, input)
  } catch (error) {
    await discardImage(stagingId)
    throw error
  }
}

async function attachStagedImage(db: Db, stagingId: string, receiptId: string): Promise<void> {
  try {
    await moveReceiptImage(stagingId, receiptId)
  } catch (error) {
    await apiSurface.receipts.remove(db, { id: receiptId })
    await discardImage(stagingId)
    throw error
  }
}

async function createReceiptWithImage(db: Db, upload: ReceiptFileUpload, image: PreparedReceiptImage) {
  const input = receiptRowInput(upload, image)
  const stagingId = `staging-${crypto.randomUUID()}`
  await saveReceiptImage(stagingId, image.bytes)
  const created = await insertReceiptRow(db, input, stagingId)
  await attachStagedImage(db, stagingId, created.id)
  return created
}

export function createLocalApiFor(database: Pick<LocalDatabase, "run">): Api {
  const call = async <Result>(task: (db: Db) => Promise<Result>): Promise<Result> => {
    try {
      return await database.run(task)
    } catch (error) {
      throw toApiError(error)
    }
  }
  const surface = apiSurface

  return {
    accounts: {
      list: () => call((db) => surface.accounts.list(db)),
      create: (input) => call((db) => surface.accounts.create(db, parseInput(accountInputSchema, input))),
    },
    csvProfiles: {
      list: () => call((db) => surface.csvProfiles.list(db)),
      create: (input) => call((db) => surface.csvProfiles.create(db, parseInput(csvProfileSchema, input))),
      update: (id, input) =>
        call((db) =>
          surface.csvProfiles.update(db, { ...parseInput(csvProfileSchema, input), id: parseInput(idSchema, id) }),
        ),
      remove: (id) => call((db) => surface.csvProfiles.remove(db, { id: parseInput(idSchema, id) })),
    },
    imports: {
      list: () => call((db) => surface.imports.list(db)),
      preview: (upload) => call(async (db) => surface.imports.preview(db, await toImportSource(upload))),
      commit: (upload) => call(async (db) => surface.imports.commit(db, await toImportSource(upload))),
      remove: (id) => call((db) => surface.imports.remove(db, { id: parseInput(idSchema, id) })),
    },
    transactions: {
      create: (input) => call((db) => surface.transactions.create(db, parseInput(manualTransactionSchema, input))),
      list: ({ page, pageSize, ...filters }) =>
        call((db) =>
          surface.transactions.list(db, { ...validatedFilter(filters), ...parseInput(pageSchema, { page, pageSize }) }),
        ),
      export: (filters) =>
        call(async (db) => {
          const file = await surface.transactions.export(db, validatedFilter(filters))
          return new Blob([file.content], { type: CSV_MIME_TYPE })
        }),
      update: (id, changes) =>
        call((db) =>
          surface.transactions.update(db, {
            ...parseInput(transactionChangesSchema, changes),
            id: parseInput(idSchema, id),
          }),
        ),
      bulkUpdate: (ids, changes) =>
        call((db) => surface.transactions.bulkUpdate(db, parseInput(bulkTransactionUpdateSchema, { ids, ...changes }))),
      split: (input) => call((db) => surface.transactions.split(db, parseInput(transactionSplitSchema, input))),
      unsplit: (transactionId) =>
        call((db) => surface.transactions.unsplit(db, parseInput(transactionUnsplitSchema, { transactionId }))),
    },
    receipts: {
      list: (filter = {}) => call((db) => surface.receipts.list(db, parseInput(receiptFilterSchema, filter))),
      get: (id) => call((db) => surface.receipts.get(db, { id: parseInput(idSchema, id) })),
      create: (input) => call((db) => surface.receipts.create(db, parseInput(receiptCreateSchema, input))),
      createFromFile: async (upload) => {
        const image = await toPreparedImage(upload.file)
        return call((db) => createReceiptWithImage(db, upload, image))
      },
      update: (id, patch) =>
        call((db) =>
          surface.receipts.update(db, { ...parseInput(receiptUpdateSchema, patch), id: parseInput(idSchema, id) }),
        ),
      remove: async (id) => {
        const removed = await call((db) => surface.receipts.remove(db, { id: parseInput(idSchema, id) }))
        await discardImage(removed.id)
        return removed
      },
      link: (id, transactionId) =>
        call((db) => surface.receipts.link(db, parseInput(receiptLinkSchema, { id, transactionId }))),
      unlink: (id) => call((db) => surface.receipts.unlink(db, { id: parseInput(idSchema, id) })),
      candidates: (id, options = {}) =>
        call((db) =>
          surface.receipts.candidates(db, {
            ...parseInput(candidateOptionsSchema, options),
            id: parseInput(idSchema, id),
          }),
        ),
      matchPending: (accountId) =>
        call((db) => surface.receipts.matchPending(db, { accountId: parseInput(idSchema, accountId) })),
      applyLines: (id) => call((db) => surface.receipts.applyLines(db, { id: parseInput(idSchema, id) })),
    },
    themes: {
      list: () => call((db) => surface.themes.list(db)),
      create: (input) => call((db) => surface.themes.create(db, parseInput(themeInputSchema, input))),
      update: (id, input) =>
        call((db) => surface.themes.update(db, { ...parseInput(themeInputSchema, input), id: parseInput(idSchema, id) })),
      remove: (id) => call((db) => surface.themes.remove(db, { id: parseInput(idSchema, id) })),
    },
    categories: {
      list: () => call((db) => surface.categories.list(db)),
      create: (input) => call((db) => surface.categories.create(db, parseInput(categoryInputSchema, input))),
      update: (id, input) =>
        call((db) =>
          surface.categories.update(db, { ...parseInput(categoryInputSchema, input), id: parseInput(idSchema, id) }),
        ),
      remove: (id) => call((db) => surface.categories.remove(db, { id: parseInput(idSchema, id) })),
    },
    rules: {
      list: () => call((db) => surface.rules.list(db)),
      create: (input) => call((db) => surface.rules.create(db, parseInput(rulePayloadSchema, input))),
      update: (id, input) =>
        call((db) => surface.rules.update(db, { ...parseInput(rulePayloadSchema, input), id: parseInput(idSchema, id) })),
      remove: (id) => call((db) => surface.rules.remove(db, { id: parseInput(idSchema, id) })),
      test: (matcher) => call((db) => surface.rules.test(db, parseInput(ruleMatcherSchema, matcher))),
      apply: (scope) => call((db) => surface.rules.apply(db, parseInput(applyRulesInputSchema, { scope }))),
    },
    fixedItems: {
      list: () => call((db) => surface.fixedItems.list(db)),
      create: (input) => call((db) => surface.fixedItems.create(db, parseInput(fixedItemPayloadSchema, input))),
      update: (id, input) =>
        call((db) =>
          surface.fixedItems.update(db, { ...parseInput(fixedItemPayloadSchema, input), id: parseInput(idSchema, id) }),
        ),
      remove: (id) => call((db) => surface.fixedItems.remove(db, { id: parseInput(idSchema, id) })),
      overview: (from, to) =>
        call((db) =>
          surface.fixedItems.overview(db, { from: parseInput(optionalIsoDate, from), to: parseInput(optionalIsoDate, to) }),
        ),
      transactions: (id) => call((db) => surface.fixedItems.transactions(db, { id: parseInput(idSchema, id) })),
    },
    budgets: {
      list: () => call((db) => surface.budgets.list(db)),
      create: (input) => call((db) => surface.budgets.create(db, parseInput(budgetPayloadSchema, input))),
      update: (id, input) =>
        call((db) =>
          surface.budgets.update(db, { ...parseInput(budgetPayloadSchema, input), id: parseInput(idSchema, id) }),
        ),
      remove: (id) => call((db) => surface.budgets.remove(db, { id: parseInput(idSchema, id) })),
      overview: (date) => call((db) => surface.budgets.overview(db, { date: parseInput(optionalIsoDate, date) })),
    },
    dashboard: {
      overview: (date) => call((db) => surface.dashboard.overview(db, { date: parseInput(optionalIsoDate, date) })),
    },
  }
}

export async function createLocalApi(vault: Vault): Promise<Api> {
  const database = await openLocalDb(vault)
  setLocalDatabase(database)
  return createLocalApiFor(database)
}
