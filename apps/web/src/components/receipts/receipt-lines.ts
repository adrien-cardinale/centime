import type { ReceiptLine } from "@centime/core"
import type { Receipt } from "@/lib/api"
import { numberFormatter } from "@/lib/format"

const VERY_LIKELY_SCORE = 0.8
const LIKELY_SCORE = 0.5

export type MatchLevel = "veryLikely" | "likely" | "possible"

export function matchLevelOf(score: number): MatchLevel {
  if (score >= VERY_LIKELY_SCORE) return "veryLikely"
  if (score >= LIKELY_SCORE) return "likely"
  return "possible"
}

export function toCents(amount: number): number {
  return Math.round(amount * 100)
}

export function linesTotalCents(lines: readonly Pick<ReceiptLine, "amount">[]): number {
  return lines.reduce((sum, line) => sum + toCents(line.amount), 0)
}

export type LinesGap = { linesCents: number; totalCents: number; gapCents: number }

export function linesTotalGap(total: number | null, lines: readonly Pick<ReceiptLine, "amount">[]): LinesGap | null {
  if (total === null || lines.length === 0) return null
  const linesCents = linesTotalCents(lines)
  const totalCents = toCents(Math.abs(total))
  if (linesCents === totalCents) return null
  return { linesCents, totalCents, gapCents: linesCents - totalCents }
}

export function lineCategoryCount(lines: readonly ReceiptLine[] | null): number {
  return new Set((lines ?? []).map((line) => line.categoryId)).size
}

export function canSplitFromLines(receipt: Receipt): boolean {
  return receipt.status === "linked" && lineCategoryCount(receipt.lines) >= 2
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return numberFormatter({ style: "unit", unit: "kilobyte", maximumFractionDigits: 0 }).format(bytes / 1024)
  }
  return numberFormatter({ style: "unit", unit: "megabyte", maximumFractionDigits: 1 }).format(bytes / (1024 * 1024))
}
