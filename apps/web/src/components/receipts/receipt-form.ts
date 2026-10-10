import { MAX_RECEIPT_LINES, type ReceiptLineInput, receiptCreateSchema, receiptLineSchema } from "@centime/core"
import { z } from "zod"
import i18n from "@/i18n"
import type { Receipt } from "@/lib/api"
import { parseAmountInput } from "@/lib/format"

function invalidAmount(): string {
  return i18n.t("receipts.details.invalidAmount")
}

const optionalAmountSchema = z.string().transform((text, context) => {
  if (text.trim() === "") return null
  const amount = parseAmountInput(text)
  if (amount !== null) return Math.abs(amount)
  context.addIssue({ code: "custom", message: invalidAmount() })
  return z.NEVER
})

const lineAmountSchema = z.string().transform((text, context) => {
  const amount = parseAmountInput(text)
  if (amount !== null && amount !== 0) return amount
  context.addIssue({ code: "custom", message: invalidAmount() })
  return z.NEVER
})

const lineFormSchema = z
  .object({ label: z.string(), amountText: lineAmountSchema, categoryId: z.string().nullable() })
  .transform(({ label, amountText, categoryId }): ReceiptLineInput => ({ label, amount: amountText, categoryId }))
  .pipe(receiptLineSchema)

const emptyToNull = z.string().transform((text): string | null | undefined => (text.trim() === "" ? null : text))

export const receiptDetailsSchema = z.object({
  accountId: receiptCreateSchema.shape.accountId,
  merchant: receiptCreateSchema.shape.merchant,
  totalText: optionalAmountSchema,
  receiptDate: emptyToNull.pipe(receiptCreateSchema.shape.receiptDate),
  note: receiptCreateSchema.shape.note,
  lines: z
    .array(lineFormSchema)
    .max(MAX_RECEIPT_LINES)
    .transform((lines) => (lines.length === 0 ? null : lines)),
})

export type ReceiptDetailsValues = z.input<typeof receiptDetailsSchema>
export type ReceiptLineValues = ReceiptDetailsValues["lines"][number]
export type ReceiptDetailsParsed = z.output<typeof receiptDetailsSchema>

export type ReceiptDetails = {
  accountId: string
  merchant: string | null
  total: number | null
  receiptDate: string | null
  note: string | null
  lines: ReceiptDetailsParsed["lines"]
}

export function toReceiptDetails({ totalText, ...parsed }: ReceiptDetailsParsed): ReceiptDetails {
  return { ...parsed, total: totalText }
}

function amountText(amount: number | null): string {
  return amount === null ? "" : amount.toFixed(2)
}

export function emptyLine(): ReceiptLineValues {
  return { label: "", amountText: "", categoryId: null }
}

type DetailsSource = Partial<Pick<Receipt, "merchant" | "total" | "receiptDate" | "note" | "lines">> & {
  accountId: string
}

export function detailsFormValues(source: DetailsSource): ReceiptDetailsValues {
  return {
    accountId: source.accountId,
    merchant: source.merchant ?? "",
    totalText: amountText(source.total ?? null),
    receiptDate: source.receiptDate ?? "",
    note: source.note ?? "",
    lines: (source.lines ?? []).map((line) => ({
      label: line.label,
      amountText: amountText(line.amount),
      categoryId: line.categoryId,
    })),
  }
}
