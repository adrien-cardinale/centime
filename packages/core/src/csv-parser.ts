import { normalizeAccountIdentifier } from "./account-identifier"
import type { CsvColumns, CsvProfile } from "./csv-profile"
import { type CsvRecord, tokenizeCsv } from "./csv-tokenizer"
import { CsvValueError, isCurrencyCode, parseAmountValue, parseDateValue, resolveStatus, sameText } from "./csv-values"
import type { ParseError, ParsedTransaction, ParseResult } from "./parsed-transaction"
import { decodeBytes } from "./text-decoding"

type ColumnRole = keyof CsvColumns | "amount" | "indicator"

type ColumnReference = { role: ColumnRole; name: string }

export type CsvFileFormat = Pick<CsvProfile, "encoding" | "delimiter" | "hasHeader">

export type CsvColumnChoice = { name: string; sample: string | null }

type CsvLayout = {
  indexes: Partial<Record<ColumnRole, number>>
  names: Partial<Record<ColumnRole, string>>
  width: number | null
  rows: CsvRecord[]
}

const COLUMN_ROLES = [
  "date",
  "valueDate",
  "label",
  "merchant",
  "account",
  "currency",
  "balance",
  "category",
  "status",
] as const satisfies readonly (keyof CsvColumns)[]

export const CSV_HEADER_SAMPLE_SIZE = 64 * 1024

function configuredColumns(profile: CsvProfile): ColumnReference[] {
  const columns: ColumnReference[] = COLUMN_ROLES.flatMap((role) => {
    const name = profile.columns[role]
    return name ? [{ role, name }] : []
  })
  columns.push({ role: "amount", name: profile.amount.column })
  if (profile.amount.mode === "debitCredit") {
    columns.push({ role: "indicator", name: profile.amount.indicatorColumn })
  }
  return columns
}

function indexFromHeader(header: string[], name: string): number | undefined {
  const index = header.findIndex((cell) => sameText(cell, name))
  return index === -1 ? undefined : index
}

function indexFromPosition(name: string): number | undefined {
  const position = Number(name)
  return Number.isInteger(position) && position >= 1 ? position - 1 : undefined
}

function resolveLayout(records: CsvRecord[], profile: CsvProfile): CsvLayout | ParseError {
  const [headerRecord, ...dataRecords] = records
  const header = profile.hasHeader ? headerRecord?.fields : undefined
  if (profile.hasHeader && !header) return { line: 1, message: "Fichier vide" }
  const layout: CsvLayout = {
    indexes: {},
    names: {},
    width: header ? header.length : null,
    rows: profile.hasHeader ? dataRecords : records,
  }
  for (const { role, name } of configuredColumns(profile)) {
    const index = header ? indexFromHeader(header, name) : indexFromPosition(name)
    if (index === undefined) return { line: 1, message: `Colonne introuvable : « ${name} »` }
    layout.indexes[role] = index
    layout.names[role] = name
  }
  return layout
}

class CsvRowReader {
  constructor(
    private readonly fields: string[],
    private readonly layout: CsvLayout,
  ) {}

  optional(role: ColumnRole): string | null {
    const index = this.layout.indexes[role]
    if (index === undefined) return null
    const value = this.fields[index]?.trim() ?? ""
    return value === "" ? null : value
  }

  required(role: ColumnRole): string {
    const value = this.optional(role)
    if (value === null) throw new CsvValueError(`Colonne « ${this.layout.names[role] ?? role} » vide`)
    return value
  }
}

function readAmount(reader: CsvRowReader, profile: CsvProfile): number {
  const amount = parseAmountValue(reader.required("amount"), profile.decimalSeparator)
  if (profile.amount.mode === "signed") return amount
  const isDebit = sameText(reader.optional("indicator") ?? "", profile.amount.debitValue)
  return isDebit ? -Math.abs(amount) : Math.abs(amount)
}

function readOptionalDate(reader: CsvRowReader, profile: CsvProfile): string | null {
  const value = reader.optional("valueDate")
  return value === null ? null : parseDateValue(value, profile.dateFormat)
}

function readBalance(reader: CsvRowReader, profile: CsvProfile): number | null {
  const value = reader.optional("balance")
  return value === null ? null : parseAmountValue(value, profile.decimalSeparator)
}

function readAccount(reader: CsvRowReader): string | null {
  const value = reader.optional("account")
  return value === null ? null : normalizeAccountIdentifier(value)
}

function readCurrency(reader: CsvRowReader, profile: CsvProfile): string {
  const value = reader.optional("currency")
  if (value === null) return profile.defaultCurrency
  if (!isCurrencyCode(value)) throw new CsvValueError(`Devise invalide : « ${value} »`)
  return value.toUpperCase()
}

function toTransaction(reader: CsvRowReader, profile: CsvProfile): ParsedTransaction {
  const merchant = reader.optional("merchant")
  const rawLabel = reader.optional("label") ?? merchant
  if (rawLabel === null) throw new CsvValueError("Libellé vide")
  return {
    accountIdentifier: readAccount(reader),
    bookingDate: parseDateValue(reader.required("date"), profile.dateFormat),
    valueDate: readOptionalDate(reader, profile),
    rawLabel,
    merchant,
    amount: readAmount(reader, profile),
    currency: readCurrency(reader, profile),
    status: resolveStatus(reader.optional("status"), profile.statusMap),
    balanceAfter: readBalance(reader, profile),
    sourceRef: null,
    providerCategory: reader.optional("category"),
  }
}

function checkWidth(record: CsvRecord, width: number | null): void {
  if (width !== null && record.fields.length !== width) {
    throw new CsvValueError(`${record.fields.length} colonnes au lieu de ${width}`)
  }
}

export function parseCsv(bytes: Uint8Array, profile: CsvProfile): ParseResult {
  const records = tokenizeCsv(decodeBytes(bytes, profile.encoding), profile.delimiter)
  const layout = resolveLayout(records, profile)
  if ("message" in layout) return { transactions: [], errors: [layout] }
  const result: ParseResult = { transactions: [], errors: [] }
  for (const record of layout.rows) {
    try {
      checkWidth(record, layout.width)
      result.transactions.push(toTransaction(new CsvRowReader(record.fields, layout), profile))
    } catch (error) {
      if (!(error instanceof CsvValueError)) throw error
      result.errors.push({ line: record.line, message: error.message })
    }
  }
  return result
}

function readHeader(bytes: Uint8Array, profile: CsvProfile): string[] {
  const sample = decodeBytes(bytes.subarray(0, CSV_HEADER_SAMPLE_SIZE), profile.encoding)
  return tokenizeCsv(sample, profile.delimiter)[0]?.fields ?? []
}

function matchesProfile(bytes: Uint8Array, profile: CsvProfile): boolean {
  const required = profile.detect.requiredHeaders
  if (required.length === 0) return false
  const header = readHeader(bytes, profile)
  return required.every((name) => indexFromHeader(header, name) !== undefined)
}

function sampleAt(record: CsvRecord | undefined, index: number): string | null {
  const value = record?.fields[index]?.trim() ?? ""
  return value === "" ? null : value
}

export function findCsvColumn(columns: CsvColumnChoice[], name: string): CsvColumnChoice | undefined {
  return columns.find((column) => sameText(column.name, name))
}

export function listCsvColumns(bytes: Uint8Array, format: CsvFileFormat): CsvColumnChoice[] {
  const sample = decodeBytes(bytes.subarray(0, CSV_HEADER_SAMPLE_SIZE), format.encoding)
  const [first, second] = tokenizeCsv(sample, format.delimiter)
  if (!first) return []
  if (!format.hasHeader) {
    return first.fields.map((_, index) => ({ name: String(index + 1), sample: sampleAt(first, index) }))
  }
  const columns: CsvColumnChoice[] = []
  first.fields.forEach((cell, index) => {
    const name = cell.trim()
    if (name === "" || findCsvColumn(columns, name)) return
    columns.push({ name, sample: sampleAt(second, index) })
  })
  return columns
}

export function detectCsvProfile<Profile extends CsvProfile>(bytes: Uint8Array, profiles: Profile[]): Profile | null {
  const matches = profiles.filter((profile) => matchesProfile(bytes, profile))
  matches.sort((left, right) => right.detect.requiredHeaders.length - left.detect.requiredHeaders.length)
  return matches[0] ?? null
}
