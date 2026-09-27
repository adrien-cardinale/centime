import { format, isValid, parse } from "date-fns"
import type { DecimalSeparator } from "./csv-profile"
import type { IsoDate, TransactionStatus } from "./types"

export class CsvValueError extends Error {}

const REFERENCE_DATE = new Date(2000, 0, 1)
const THOUSANDS_SEPARATORS = /['’\s  ]/g
const AMOUNT_PATTERN = /^[+-]?(\d+(\.\d*)?|\.\d+)$/

function parseWithFormat(value: string, dateFormat: string): Date {
  try {
    return parse(value.trim(), dateFormat, REFERENCE_DATE)
  } catch (error) {
    if (error instanceof RangeError) throw new CsvValueError(`Format de date invalide : « ${dateFormat} »`)
    throw error
  }
}

export function parseDateValue(value: string, dateFormat: string): IsoDate {
  const parsed = parseWithFormat(value, dateFormat)
  if (!isValid(parsed)) throw new CsvValueError(`Date invalide : « ${value} »`)
  return format(parsed, "yyyy-MM-dd")
}

export function parseAmountValue(value: string, decimalSeparator: DecimalSeparator): number {
  const compact = value.trim().replace(THOUSANDS_SEPARATORS, "").replace("−", "-")
  const normalized = decimalSeparator === "," ? compact.replace(",", ".") : compact
  if (!AMOUNT_PATTERN.test(normalized)) throw new CsvValueError(`Montant invalide : « ${value} »`)
  return Number(normalized)
}

export function resolveStatus(value: string | null, statusMap: Record<string, TransactionStatus> | undefined): TransactionStatus {
  if (value === null || !statusMap) return "booked"
  const wanted = normalizeText(value)
  const match = Object.entries(statusMap).find(([key]) => normalizeText(key) === wanted)
  return match?.[1] ?? "booked"
}

export function normalizeText(value: string): string {
  return value.normalize("NFC").trim()
}

export function sameText(left: string, right: string): boolean {
  return normalizeText(left).toLowerCase() === normalizeText(right).toLowerCase()
}
