import { z } from "zod"
import { ACCOUNT_KINDS, TRANSACTION_STATUSES } from "./types"

export const CSV_ENCODINGS = ["utf-8", "iso-8859-1"] as const
export const CSV_DELIMITERS = [";", ",", "\t"] as const
export const DECIMAL_SEPARATORS = [".", ","] as const
export const CSV_AMOUNT_MODES = ["signed", "debitCredit"] as const

export type CsvEncoding = (typeof CSV_ENCODINGS)[number]
export type CsvDelimiter = (typeof CSV_DELIMITERS)[number]
export type DecimalSeparator = (typeof DECIMAL_SEPARATORS)[number]
export type CsvAmountMode = (typeof CSV_AMOUNT_MODES)[number]

const columnName = z.string().trim().min(1, "Nom de colonne obligatoire")
const optionalColumnName = columnName.optional()

export const csvAmountConfigSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("signed"), column: columnName }),
  z.object({
    mode: z.literal("debitCredit"),
    column: columnName,
    indicatorColumn: columnName,
    debitValue: z.string().trim().min(1, "Valeur de débit obligatoire"),
  }),
])

export const csvColumnsSchema = z.object({
  date: columnName,
  valueDate: optionalColumnName,
  label: columnName,
  merchant: optionalColumnName,
  account: optionalColumnName,
  currency: optionalColumnName,
  balance: optionalColumnName,
  category: optionalColumnName,
  status: optionalColumnName,
})

export const csvProfileSchema = z.object({
  name: z.string().trim().min(1, "Le nom est obligatoire"),
  accountKind: z.enum(ACCOUNT_KINDS),
  encoding: z.enum(CSV_ENCODINGS),
  delimiter: z.enum(CSV_DELIMITERS),
  hasHeader: z.boolean(),
  dateFormat: z.string().trim().min(1, "Format de date obligatoire"),
  decimalSeparator: z.enum(DECIMAL_SEPARATORS),
  defaultCurrency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Code ISO à trois lettres"),
  columns: csvColumnsSchema,
  amount: csvAmountConfigSchema,
  statusMap: z.record(z.string().trim().min(1), z.enum(TRANSACTION_STATUSES)).optional(),
  detect: z.object({ requiredHeaders: z.array(columnName) }),
})

export type CsvAmountConfig = z.infer<typeof csvAmountConfigSchema>
export type CsvColumns = z.infer<typeof csvColumnsSchema>
export type CsvProfileInput = z.infer<typeof csvProfileSchema>
export type CsvProfile = CsvProfileInput & { id: string }
