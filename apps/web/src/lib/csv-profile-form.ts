import {
  ACCOUNT_KINDS,
  CSV_AMOUNT_MODES,
  CSV_DELIMITERS,
  CSV_ENCODINGS,
  csvProfileSchema,
  DECIMAL_SEPARATORS,
  TRANSACTION_STATUSES,
  type TransactionStatus,
} from "@centime/core"
import { z } from "zod"
import type { CsvProfile } from "./api"

const csvProfileFieldsSchema = z.object({
  name: z.string(),
  accountKind: z.enum(ACCOUNT_KINDS),
  encoding: z.enum(CSV_ENCODINGS),
  delimiter: z.enum(CSV_DELIMITERS),
  hasHeader: z.boolean(),
  dateFormat: z.string(),
  decimalSeparator: z.enum(DECIMAL_SEPARATORS),
  defaultCurrency: z.string(),
  columns: z.object({
    date: z.string(),
    valueDate: z.string(),
    label: z.string(),
    merchant: z.string(),
    account: z.string(),
    currency: z.string(),
    balance: z.string(),
    category: z.string(),
    status: z.string(),
  }),
  amount: z.object({
    mode: z.enum(CSV_AMOUNT_MODES),
    column: z.string(),
    indicatorColumn: z.string(),
    debitValue: z.string(),
  }),
  detect: z.object({ requiredHeaders: z.string() }),
  statuses: z.array(z.object({ value: z.string(), status: z.enum(TRANSACTION_STATUSES) })),
})

type CsvProfileFields = z.infer<typeof csvProfileFieldsSchema>
type CsvProfileSchemaInput = z.input<typeof csvProfileSchema>

function blankToUndefined(value: string): string | undefined {
  const trimmed = value.trim()
  return trimmed === "" ? undefined : trimmed
}

function toAmount(amount: CsvProfileFields["amount"]): CsvProfileSchemaInput["amount"] {
  if (amount.mode === "signed") return { mode: "signed", column: amount.column }
  return { mode: "debitCredit", column: amount.column, indicatorColumn: amount.indicatorColumn, debitValue: amount.debitValue }
}

function toStatusMap(statuses: CsvProfileFields["statuses"]): CsvProfileSchemaInput["statusMap"] {
  const entries = statuses
    .filter((entry) => entry.value.trim() !== "")
    .map((entry): [string, TransactionStatus] => [entry.value.trim(), entry.status])
  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

function toRequiredHeaders(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "")
}

function toProfileInput(fields: CsvProfileFields): CsvProfileSchemaInput {
  const { columns } = fields
  return {
    name: fields.name,
    accountKind: fields.accountKind,
    encoding: fields.encoding,
    delimiter: fields.delimiter,
    hasHeader: fields.hasHeader,
    dateFormat: fields.dateFormat,
    decimalSeparator: fields.decimalSeparator,
    defaultCurrency: fields.defaultCurrency,
    columns: {
      date: columns.date,
      valueDate: blankToUndefined(columns.valueDate),
      label: columns.label,
      merchant: blankToUndefined(columns.merchant),
      account: blankToUndefined(columns.account),
      currency: blankToUndefined(columns.currency),
      balance: blankToUndefined(columns.balance),
      category: blankToUndefined(columns.category),
      status: blankToUndefined(columns.status),
    },
    amount: toAmount(fields.amount),
    statusMap: toStatusMap(fields.statuses),
    detect: { requiredHeaders: toRequiredHeaders(fields.detect.requiredHeaders) },
  }
}

export const csvProfileFormSchema = csvProfileFieldsSchema.transform(toProfileInput).pipe(csvProfileSchema)

export type CsvProfileFormValues = z.input<typeof csvProfileFormSchema>

export const emptyCsvProfileFormValues: CsvProfileFormValues = {
  name: "",
  accountKind: "bank",
  encoding: "utf-8",
  delimiter: ";",
  hasHeader: true,
  dateFormat: "dd.MM.yyyy",
  decimalSeparator: ".",
  defaultCurrency: "CHF",
  columns: {
    date: "",
    valueDate: "",
    label: "",
    merchant: "",
    account: "",
    currency: "",
    balance: "",
    category: "",
    status: "",
  },
  amount: { mode: "signed", column: "", indicatorColumn: "", debitValue: "" },
  detect: { requiredHeaders: "" },
  statuses: [],
}

export function csvProfileToFormValues(profile: CsvProfile): CsvProfileFormValues {
  const { columns, amount } = profile
  return {
    name: profile.name,
    accountKind: profile.accountKind,
    encoding: profile.encoding,
    delimiter: profile.delimiter,
    hasHeader: profile.hasHeader,
    dateFormat: profile.dateFormat,
    decimalSeparator: profile.decimalSeparator,
    defaultCurrency: profile.defaultCurrency,
    columns: {
      date: columns.date,
      valueDate: columns.valueDate ?? "",
      label: columns.label,
      merchant: columns.merchant ?? "",
      account: columns.account ?? "",
      currency: columns.currency ?? "",
      balance: columns.balance ?? "",
      category: columns.category ?? "",
      status: columns.status ?? "",
    },
    amount: {
      mode: amount.mode,
      column: amount.column,
      indicatorColumn: amount.mode === "debitCredit" ? amount.indicatorColumn : "",
      debitValue: amount.mode === "debitCredit" ? amount.debitValue : "",
    },
    detect: { requiredHeaders: profile.detect.requiredHeaders.join("\n") },
    statuses: Object.entries(profile.statusMap ?? {}).map(([value, status]) => ({ value, status })),
  }
}
