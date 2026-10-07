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
  // Le séparateur opposé au séparateur décimal du profil est un séparateur de milliers (« 1.234,56 », « 1,234.56 »).
  const normalized =
    decimalSeparator === "," ? compact.replaceAll(".", "").replace(",", ".") : compact.replaceAll(",", "")
  if (!AMOUNT_PATTERN.test(normalized)) throw new CsvValueError(`Montant invalide : « ${value} »`)
  return Number(normalized)
}

const CURRENCY_PATTERN = /^[A-Za-z]{3}$/

/** `Intl.NumberFormat` lève une RangeError sur tout code qui n'a pas la forme ISO 4217 (trois lettres). */
export function isCurrencyCode(value: string): boolean {
  return CURRENCY_PATTERN.test(value)
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
