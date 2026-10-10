import { z } from "zod"
import { isoDateSchema } from "./fixed-item-payload"
import { RECEIPT_STATUSES } from "./types"

export const MAX_RECEIPT_BYTES = 7 * 1024 * 1024
export const MAX_RECEIPT_LINES = 200
export const MAX_RECEIPT_LABEL_LENGTH = 200
export const MAX_RECEIPT_MERCHANT_LENGTH = 200
export const MAX_RECEIPT_NOTE_LENGTH = 1000

const RECEIPT_MIME_PATTERN = /^(image\/[a-z0-9.+-]+|application\/pdf)$/
const SHA256_PATTERN = /^[0-9a-f]{64}$/
const NOTHING_TO_UPDATE = "Aucune modification demandée"

export const receiptStatusSchema = z.enum(RECEIPT_STATUSES, { error: "Statut de ticket invalide" })

const amountSchema = z.number({ error: "Montant invalide" }).refine(Number.isFinite, "Montant invalide")

export const receiptLineSchema = z.object({
  label: z.string().trim().min(1, "Le libellé est obligatoire").max(MAX_RECEIPT_LABEL_LENGTH, "Libellé trop long"),
  amount: amountSchema,
  categoryId: z.uuid("Catégorie invalide").nullable().default(null),
})

function optionalText(maxLength: number, tooLong: string) {
  return z
    .string()
    .trim()
    .max(maxLength, tooLong)
    .nullable()
    .transform((text) => text || null)
}

const merchantSchema = optionalText(MAX_RECEIPT_MERCHANT_LENGTH, "Commerçant trop long")
const noteSchema = optionalText(MAX_RECEIPT_NOTE_LENGTH, "Note trop longue")
const totalSchema = amountSchema.nullable()
const receiptDateSchema = isoDateSchema.nullable()
const linesSchema = z.array(receiptLineSchema).max(MAX_RECEIPT_LINES, `${MAX_RECEIPT_LINES} lignes au maximum`).nullable()

export const receiptCreateSchema = z.object({
  accountId: z.string({ error: "Choisissez un compte" }).min(1, "Choisissez un compte"),
  transactionId: z.string().min(1).nullable().default(null),
  mime: z.string().regex(RECEIPT_MIME_PATTERN, "Format d'image non pris en charge"),
  size: z
    .number({ error: "Taille invalide" })
    .int("Taille invalide")
    .positive("Fichier vide")
    .max(MAX_RECEIPT_BYTES, "Fichier trop volumineux (7 Mo maximum)"),
  sha256: z.string().regex(SHA256_PATTERN, "Empreinte SHA-256 invalide"),
  capturedAt: z.iso.datetime("Date de capture invalide").default(() => new Date().toISOString()),
  merchant: merchantSchema.default(null),
  total: totalSchema.default(null),
  receiptDate: receiptDateSchema.default(null),
  note: noteSchema.default(null),
  lines: linesSchema.default(null),
})

const updateFields = {
  merchant: merchantSchema.optional(),
  total: totalSchema.optional(),
  receiptDate: receiptDateSchema.optional(),
  note: noteSchema.optional(),
  lines: linesSchema.optional(),
  status: receiptStatusSchema.optional(),
}

export const receiptUpdateSchema = z
  .object(updateFields)
  .refine((patch) => Object.values(patch).some((value) => value !== undefined), NOTHING_TO_UPDATE)

export const receiptFilterSchema = z.object({
  accountId: z.string().min(1).optional(),
  status: receiptStatusSchema.optional(),
  transactionId: z.string().min(1).optional(),
})

export const receiptLinkSchema = z.object({
  id: z.string().min(1, "Ticket invalide"),
  transactionId: z.string().min(1, "Transaction invalide"),
})

export type ReceiptLineInput = z.input<typeof receiptLineSchema>
export type ReceiptLine = z.output<typeof receiptLineSchema>
export type ReceiptCreateInput = z.input<typeof receiptCreateSchema>
export type ReceiptCreate = z.output<typeof receiptCreateSchema>
export type ReceiptUpdateInput = z.input<typeof receiptUpdateSchema>
export type ReceiptUpdate = z.output<typeof receiptUpdateSchema>
export type ReceiptFilter = z.output<typeof receiptFilterSchema>
export type ReceiptLink = z.output<typeof receiptLinkSchema>
