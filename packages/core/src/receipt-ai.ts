import { isValid, parse } from "date-fns"
import { z } from "zod"

export const receiptAiOutputSchema = z.object({
  merchant: z.string().nullable().describe("Shop or business name as printed, or null if unreadable"),
  total: z.number().nullable().describe("Amount actually paid, positive, or null if unreadable"),
  receiptDate: z.string().nullable().describe("Purchase date as YYYY-MM-DD, or null if unreadable"),
  currency: z.string().nullable().describe("ISO 4217 code such as CHF or EUR, or null if not shown"),
  lines: z
    .array(
      z.object({
        label: z.string().describe("Item label as printed"),
        amount: z.number().describe("Line amount: positive for a purchase, negative for a discount or refund"),
        categoryName: z.string().nullable().describe("Exact name from the provided category list, or null"),
      }),
    )
    .describe("Purchased items in receipt order, without totals, taxes or payment lines"),
  confidence: z
    .object({
      merchant: z.number().describe("0 to 1"),
      total: z.number().describe("0 to 1"),
      receiptDate: z.number().describe("0 to 1"),
    })
    .describe("How sure you are of each field, from 0 (guess) to 1 (clearly printed)"),
})

export type ReceiptAiOutput = z.infer<typeof receiptAiOutputSchema>

export type ReceiptAiCategory = { id: string; name: string }

export type ReceiptAiLine = { label: string; amount: number; categoryId: string | null }

export type ReceiptAiResult = {
  merchant: string | null
  total: number | null
  receiptDate: string | null
  currency: string | null
  lines: ReceiptAiLine[]
  confidence: { merchant: number; total: number; receiptDate: number }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const CURRENCY_CODE = /^[A-Z]{3}$/

export function buildReceiptAiInstruction(categories: ReadonlyArray<{ name: string }>, today: string): string {
  const categoryList = categories.length
    ? categories.map((category) => `- ${category.name}`).join("\n")
    : "(no categories: use null for every line)"
  return [
    "Read the receipt in the image and extract its data.",
    `Today is ${today}. The receipt date is on or before today.`,
    "Rules:",
    "- merchant: the shop or business name as printed on the receipt.",
    "- total: the amount actually paid, as a positive number. Ignore subtotals, taxes, change and payment lines.",
    "- receiptDate: the purchase date in YYYY-MM-DD format.",
    "- currency: the ISO 4217 code (for example CHF or EUR) if the receipt shows one.",
    "- lines: one entry per purchased item. Amounts are positive for purchases and negative for discounts or refunds.",
    "- categoryName: pick the most fitting name from the category list below, copied exactly, or null if none fits.",
    "- Never invent data. Use null for any field you cannot read, and give it a low confidence.",
    "- confidence: a number from 0 to 1 for merchant, total and receiptDate.",
    "Category list:",
    categoryList,
  ].join("\n")
}

function foldName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLocaleLowerCase()
}

function roundToCents(value: number): number {
  return Math.round(value * 100) / 100
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

function cleanText(value: string | null): string | null {
  const trimmed = value?.trim() ?? ""
  return trimmed === "" ? null : trimmed
}

function cleanAmount(value: number | null): number | null {
  return value !== null && Number.isFinite(value) ? roundToCents(value) : null
}

function cleanDate(value: string | null): string | null {
  const text = value?.trim() ?? ""
  if (!ISO_DATE.test(text)) return null
  return isValid(parse(text, "yyyy-MM-dd", new Date(0))) ? text : null
}

function cleanCurrency(value: string | null): string | null {
  const code = value?.trim().toUpperCase() ?? ""
  return CURRENCY_CODE.test(code) ? code : null
}

function categoryIdFinder(categories: ReadonlyArray<ReceiptAiCategory>): (name: string | null) => string | null {
  const idsByName = new Map<string, string>()
  for (const category of categories) {
    const key = foldName(category.name)
    if (!idsByName.has(key)) idsByName.set(key, category.id)
  }
  return (name) => (name === null ? null : (idsByName.get(foldName(name)) ?? null))
}

function confidenceFor(value: unknown, confidence: number): number {
  return value === null ? 0 : clampConfidence(confidence)
}

export function toAiExtractionResult(
  output: ReceiptAiOutput,
  categories: ReadonlyArray<ReceiptAiCategory>,
): ReceiptAiResult {
  const findCategoryId = categoryIdFinder(categories)
  const merchant = cleanText(output.merchant)
  const total = cleanAmount(output.total)
  const receiptDate = cleanDate(output.receiptDate)
  const lines = output.lines.flatMap((line) => {
    const label = cleanText(line.label)
    const amount = cleanAmount(line.amount)
    if (label === null || amount === null) return []
    return [{ label, amount, categoryId: findCategoryId(line.categoryName) }]
  })
  return {
    merchant,
    total,
    receiptDate,
    currency: cleanCurrency(output.currency),
    lines,
    confidence: {
      merchant: confidenceFor(merchant, output.confidence.merchant),
      total: confidenceFor(total, output.confidence.total),
      receiptDate: confidenceFor(receiptDate, output.confidence.receiptDate),
    },
  }
}
