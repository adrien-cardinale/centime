import { format, isValid, parse } from "date-fns"
import type { DecimalSeparator } from "./csv-profile"
import type { IsoDate, TransactionStatus } from "./types"

export class CsvValueError extends Error {}

const REFERENCE_DATE = new Date(2000, 0, 1)
const SIGNED_AMOUNT_PATTERN = /^([+-]?)\s*(.*)$/su
const GROUPED_INTEGER_PATTERN = /^\d{1,3}(\D)\d{3}(?:\1\d{3})*$/u
const PLAIN_DIGITS_PATTERN = /^\d+$/
const FRACTION_PATTERN = /^\d*$/
const SPACING_SEPARATOR_PATTERN = /^['’\s]$/u

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

function isThousandsSeparator(separator: string, decimalSeparator: DecimalSeparator): boolean {
  if (SPACING_SEPARATOR_PATTERN.test(separator)) return true
  return separator === (decimalSeparator === "," ? "." : ",")
}

function integerDigits(integer: string, decimalSeparator: DecimalSeparator): string | null {
  if (integer === "" || PLAIN_DIGITS_PATTERN.test(integer)) return integer
  const separator = GROUPED_INTEGER_PATTERN.exec(integer)?.[1]
  if (separator === undefined || !isThousandsSeparator(separator, decimalSeparator)) return null
  return integer.replaceAll(separator, "")
}

export function parseAmountValue(value: string, decimalSeparator: DecimalSeparator): number {
  const invalid = new CsvValueError(`Montant invalide : « ${value} »`)
  const [, sign = "", body = ""] = SIGNED_AMOUNT_PATTERN.exec(value.trim().replace("−", "-")) ?? []
  const [integer = "", fraction, ...extra] = body.split(decimalSeparator)
  if (extra.length > 0 || (fraction !== undefined && !FRACTION_PATTERN.test(fraction))) throw invalid
  const digits = integerDigits(integer, decimalSeparator)
  if (digits === null || (digits === "" && !fraction)) throw invalid
  return Number(`${sign}${digits === "" ? "0" : digits}.${fraction ?? ""}`)
}

const CURRENCY_PATTERN = /^[A-Za-z]{3}$/

/** `Intl.NumberFormat` lève une RangeError sur tout code qui n'a pas la forme ISO 4217 (trois lettres). */
export function isCurrencyCode(value: string): boolean {
  return CURRENCY_PATTERN.test(value)
}

export function resolveStatus(
  value: string | null,
  statusMap: Record<string, TransactionStatus> | undefined,
): TransactionStatus {
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
