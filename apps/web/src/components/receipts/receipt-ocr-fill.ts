import { MAX_RECEIPT_LINES, type ReceiptOcrResult } from "@centime/core"
import type { ReceiptDetailsValues, ReceiptLineValues } from "./receipt-form"

export type OcrField = "merchant" | "totalText" | "receiptDate"

export type OcrFillTarget = Pick<ReceiptDetailsValues, OcrField | "lines">

export type OcrPatch = Partial<Record<OcrField, string>> & { lines?: ReceiptLineValues[] }

export type OcrFilledFields = Partial<Record<OcrField, { value: string; confidence: number }>>

export const LOW_CONFIDENCE = 0.6

function isBlank(text: string | null | undefined): boolean {
  return (text ?? "").trim() === ""
}

export function isFormEmptyForOcr(values: OcrFillTarget): boolean {
  return isBlank(values.merchant) && isBlank(values.totalText) && values.lines.length === 0
}

function ocrLines(result: ReceiptOcrResult): ReceiptLineValues[] {
  return result.lines.slice(0, MAX_RECEIPT_LINES).map((line) => ({
    label: line.label,
    amountText: line.amount.toFixed(2),
    categoryId: null,
  }))
}

export function ocrFormPatch(current: OcrFillTarget, result: ReceiptOcrResult, replaceableDate: boolean): OcrPatch {
  const patch: OcrPatch = {}
  if (result.merchant && isBlank(current.merchant)) patch.merchant = result.merchant
  if (result.total !== null && isBlank(current.totalText)) patch.totalText = result.total.toFixed(2)
  if (result.receiptDate && (isBlank(current.receiptDate) || replaceableDate)) patch.receiptDate = result.receiptDate
  if (result.lines.length > 0 && current.lines.length === 0) patch.lines = ocrLines(result)
  return patch
}

export function isEmptyPatch(patch: OcrPatch): boolean {
  return Object.keys(patch).length === 0
}

const CONFIDENCE_KEY: Record<OcrField, keyof ReceiptOcrResult["confidence"]> = {
  merchant: "merchant",
  totalText: "total",
  receiptDate: "receiptDate",
}

export function filledFields(patch: OcrPatch, result: ReceiptOcrResult): OcrFilledFields {
  const filled: OcrFilledFields = {}
  for (const field of Object.keys(CONFIDENCE_KEY) as OcrField[]) {
    const value = patch[field]
    if (value !== undefined) filled[field] = { value, confidence: result.confidence[CONFIDENCE_KEY[field]] }
  }
  return filled
}
