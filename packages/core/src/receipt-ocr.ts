export type ReceiptOcrLine = { label: string; amount: number }

export type ReceiptOcrConfidence = { merchant: number; total: number; receiptDate: number }

export type ReceiptOcrResult = {
  merchant: string | null
  total: number | null
  receiptDate: string | null
  lines: ReceiptOcrLine[]
  confidence: ReceiptOcrConfidence
}

export type ReceiptOcrOptions = { now?: Date }

type AmountMatch = { value: number; start: number; end: number }

type ReceiptRow = { text: string; folded: string; amounts: AmountMatch[] }

type TotalSource = "keyword" | "sum" | "lowerHalf"

type TotalPick = { amount: number; source: TotalSource; itemsEnd: number; skippedRow: number }

type ScoredText = { value: string; confidence: number }

const DECIMAL_TOKEN =
  /(?<![A-Za-z0-9]|[0-9][.,/:])(\d{1,3}(?:['’. ]\d{3})+|[0-9OolIS]+)[.,] ?([0-9OIS]{2})(?![0-9]|[.,/:][0-9]|[A-Za-z]{2})/g
const AMOUNT = /(?:(?<=^|\s)(-)\s?)?(?<!\d|\d[.,/:])(\d+\.\d{2})(?!\d|[.,/:]\d)(-(?!\d))?/g
const QUANTITY_WITH_PRICE = /(?<!\S)\d+(?:\.\d+)?\s*[xX×*]\s*-?\d+\.\d{2}(?!\d)/g
const LEADING_QUANTITY = /^\d+\s*[xX×*]?\s+(?=\S)/
const CURRENCY_TOKEN = /(?<![A-Za-z])(?:CHF|EUR|SFr\.?|Fr\.)(?![A-Za-z])|€/gi
const PRICE_SUFFIX = /^(?:[A-Z0-9*]{1,2}|CHF|EUR|€|Fr\.?)?$/i
const EDGE_PUNCTUATION = /^[\s*:.,;|\-]+|[\s*:.,;|\-]+$/g

const TOTAL_KEYWORD = /\b(?:TOTAL|TOTALE|MONTANT|SOMME|SUMME|A PAYER|NET A PAYER)\b/
const NON_TOTAL_KEYWORD =
  /SOUS[- ]?TOTAL|SUB[- ]?TOTAL|ZWISCHENSUMME|\b(?:TVA|MWST|RENDU|MONNAIE|CASH|ESPECES|CARTE|EC|MAESTRO|TWINT|VISA|MASTERCARD|POSTFINANCE|RUCKGELD)\b/
const NON_ITEM_KEYWORD = /\b(?:UID|TAUX|SOLDE|PUNKTE|POINTS)\b|CHE-/
const DISCOUNT_KEYWORD = /\b(?:RABAIS|RABATT|REMISE|REDUCTION)\b/
const MERCHANT_REJECTED = /\b(?:TEL|FAX|UID|MWST|TVA|WWW)\b|@|CHE-/
const POSTAL_CODE_LINE = /\b\d{4,5}\s+\p{L}/u
const PHONE_NUMBER = /(?:\+|\b0)\d{1,3}(?:[\s./-]?\d{2,3}){3,4}\b/
const STORE_NUMBER_SUFFIX = /\s*(?:(?:n[°o]|nr|#|filiale)\.?\s*)?\d+\s*$/i

const ISO_DATE = /(?<!\d)(\d{4})-(\d{1,2})-(\d{1,2})(?!\d)/g
const DAY_FIRST_DATE = /(?<!\d)(\d{1,2})([./-])(\d{1,2})\2(\d{4}|\d{2})(?!\d)/g

const KNOWN_CHAINS: ReadonlyArray<{ pattern: RegExp; name: string }> = [
  { pattern: /(?<![a-z])coop(?![a-z])/i, name: "Coop" },
  { pattern: /(?<![a-z])migros(?![a-z])/i, name: "Migros" },
  { pattern: /(?<![a-z])denner(?![a-z])/i, name: "Denner" },
  { pattern: /(?<![a-z])aldi(?![a-z])/i, name: "Aldi" },
  { pattern: /(?<![a-z])lidl(?![a-z])/i, name: "Lidl" },
  { pattern: /(?<![a-z])manor(?![a-z])/i, name: "Manor" },
  { pattern: /(?<![a-z])volg(?![a-z])/i, name: "Volg" },
  { pattern: /(?<![a-z])landi(?![a-z])/i, name: "Landi" },
  { pattern: /(?<![a-z])(?:sbb|cff|ffs)(?![a-z])/i, name: "SBB CFF FFS" },
  { pattern: /(?<![a-z])ikea(?![a-z])/i, name: "IKEA" },
  { pattern: /(?<![a-z])decathlon(?![a-z])/i, name: "Decathlon" },
  { pattern: /(?<![a-z])mc ?donald'?s?(?![a-z])/i, name: "McDonald's" },
  { pattern: /(?<![a-z])starbucks(?![a-z])/i, name: "Starbucks" },
]

const SUM_TOLERANCE = 0.05
const MERCHANT_ROW_LIMIT = 6
const CHAIN_ROW_LIMIT = 8
const MAX_RECEIPT_AGE_YEARS = 15
const TOTAL_CONFIDENCE: Record<TotalSource, number> = { keyword: 0.75, sum: 0.6, lowerHalf: 0.3 }
const KEYWORD_AND_SUM_CONFIDENCE = 0.95

export function parseReceiptText(text: string, options: ReceiptOcrOptions = {}): ReceiptOcrResult {
  const rows = toRows(typeof text === "string" ? text : "")
  const merchant = findMerchant(rows)
  const receiptDate = findReceiptDate(rows, options.now ?? new Date())
  const total = pickTotal(rows)
  const lines = extractItems(rows, total?.itemsEnd ?? rows.length, total?.skippedRow ?? -1)
  return {
    merchant: merchant?.value ?? null,
    total: total?.amount ?? null,
    receiptDate: receiptDate?.value ?? null,
    lines,
    confidence: {
      merchant: merchant?.confidence ?? 0,
      total: totalConfidence(total, lines),
      receiptDate: receiptDate?.confidence ?? 0,
    },
  }
}

function toRows(text: string): ReceiptRow[] {
  return text
    .split(/\r\n|\r|\n/)
    .map(normaliseLine)
    .filter((line) => line.length > 0)
    .map((line) => ({ text: line, folded: foldText(line), amounts: findAmounts(line) }))
}

function normaliseLine(line: string): string {
  const spaced = line
    .replace(/[‒-―−]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
  return spaced.replace(DECIMAL_TOKEN, canonicalDecimal)
}

function canonicalDecimal(token: string, integerPart: string, decimalPart: string): string {
  if (!/\d/.test(integerPart + decimalPart)) return token
  const integerDigits = fixDigitConfusions(integerPart).replace(/['’. ]/g, "")
  return `${integerDigits}.${fixDigitConfusions(decimalPart)}`
}

function fixDigitConfusions(value: string): string {
  return value.replace(/[Oo]/g, "0").replace(/[lI]/g, "1").replace(/S/g, "5")
}

function foldText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
}

function findAmounts(line: string): AmountMatch[] {
  return [...line.matchAll(AMOUNT)].map((match) => ({
    value: (match[1] || match[3] ? -1 : 1) * Number(match[2]),
    start: match.index,
    end: match.index + match[0].length,
  }))
}

function lastAmount(row: ReceiptRow | undefined): AmountMatch | undefined {
  return row?.amounts.at(-1)
}

function roundToCents(value: number): number {
  return Math.round(value * 100) / 100
}

function countLetters(value: string): number {
  return value.match(/\p{L}/gu)?.length ?? 0
}

function isTotalKeywordRow(row: ReceiptRow): boolean {
  return TOTAL_KEYWORD.test(row.folded) && !NON_TOTAL_KEYWORD.test(row.folded)
}

function isNonItemRow(row: ReceiptRow): boolean {
  return (
    TOTAL_KEYWORD.test(row.folded) ||
    NON_TOTAL_KEYWORD.test(row.folded) ||
    NON_ITEM_KEYWORD.test(row.folded) ||
    findDatesInLine(row.text).length > 0
  )
}

function pickTotal(rows: ReceiptRow[]): TotalPick | null {
  return findKeywordTotal(rows) ?? findSumTotal(rows) ?? findLowerHalfTotal(rows)
}

function findKeywordTotal(rows: ReceiptRow[]): TotalPick | null {
  for (const [position, row] of rows.entries()) {
    if (!isTotalKeywordRow(row)) continue
    const amount = keywordAmount(row, rows[position + 1])
    if (amount !== null) return { amount, source: "keyword", itemsEnd: position, skippedRow: -1 }
  }
  return null
}

function keywordAmount(row: ReceiptRow, nextRow: ReceiptRow | undefined): number | null {
  const sameLine = lastAmount(row)
  if (sameLine) return Math.abs(sameLine.value)
  const nextLine = lastAmount(nextRow)
  if (!nextRow || !nextLine || NON_TOTAL_KEYWORD.test(nextRow.folded)) return null
  return Math.abs(nextLine.value)
}

function findSumTotal(rows: ReceiptRow[]): TotalPick | null {
  for (const candidate of totalCandidates(rows)) {
    const items = extractItems(rows, candidate.position, -1)
    if (items.length > 0 && isCloseTo(sumAmounts(items), candidate.amount)) {
      return { amount: candidate.amount, source: "sum", itemsEnd: candidate.position, skippedRow: -1 }
    }
  }
  return null
}

function findLowerHalfTotal(rows: ReceiptRow[]): TotalPick | null {
  const lowerHalfStart = Math.floor(rows.length / 2)
  const best = totalCandidates(rows).find((candidate) => candidate.position >= lowerHalfStart)
  if (!best) return null
  return { amount: best.amount, source: "lowerHalf", itemsEnd: rows.length, skippedRow: best.position }
}

function totalCandidates(rows: ReceiptRow[]): Array<{ amount: number; position: number }> {
  return rows
    .flatMap((row, position) => {
      const last = lastAmount(row)
      return last && !NON_TOTAL_KEYWORD.test(row.folded) ? [{ amount: Math.abs(last.value), position }] : []
    })
    .sort((left, right) => right.amount - left.amount || left.position - right.position)
}

function totalConfidence(total: TotalPick | null, lines: ReceiptOcrLine[]): number {
  if (!total) return 0
  const matchesLines = lines.length > 0 && isCloseTo(sumAmounts(lines), total.amount)
  if (total.source === "keyword" && matchesLines) return KEYWORD_AND_SUM_CONFIDENCE
  return TOTAL_CONFIDENCE[total.source]
}

function sumAmounts(lines: ReceiptOcrLine[]): number {
  return roundToCents(lines.reduce((sum, line) => sum + line.amount, 0))
}

function isCloseTo(left: number, right: number): boolean {
  return Math.abs(left - right) <= SUM_TOLERANCE + 1e-9
}

function extractItems(rows: ReceiptRow[], end: number, skippedRow: number): ReceiptOcrLine[] {
  return rows.slice(0, end).flatMap((row, position) => {
    if (position === skippedRow) return []
    const item = toItem(row, rows[position - 1])
    return item ? [item] : []
  })
}

function toItem(row: ReceiptRow, previousRow: ReceiptRow | undefined): ReceiptOcrLine | null {
  const last = lastAmount(row)
  if (!last || isNonItemRow(row)) return null
  const ownLabel = labelOf(row.text, last)
  const label = countLetters(ownLabel) >= 2 ? ownLabel : carriedLabel(previousRow)
  if (!label) return null
  return { label, amount: roundToCents(signedAmount(row, last.value)) }
}

function carriedLabel(previousRow: ReceiptRow | undefined): string | null {
  if (!previousRow || previousRow.amounts.length > 0 || isNonItemRow(previousRow)) return null
  const label = tidyLabel(previousRow.text)
  return countLetters(label) >= 2 ? label : null
}

function signedAmount(row: ReceiptRow, value: number): number {
  return DISCOUNT_KEYWORD.test(row.folded) ? -Math.abs(value) : value
}

function labelOf(text: string, last: AmountMatch): string {
  const head = text.slice(0, last.start)
  const tail = text.slice(last.end).trim()
  return tidyLabel(PRICE_SUFFIX.test(tail) ? head : `${head} ${tail}`)
}

function tidyLabel(source: string): string {
  return source
    .replace(QUANTITY_WITH_PRICE, " ")
    .replace(AMOUNT, " ")
    .replace(CURRENCY_TOKEN, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(LEADING_QUANTITY, "")
    .replace(EDGE_PUNCTUATION, "")
}

function findMerchant(rows: ReceiptRow[]): ScoredText | null {
  const chain = findKnownChain(rows.slice(0, CHAIN_ROW_LIMIT))
  if (chain) return { value: chain, confidence: 0.95 }
  const firstLine = rows.slice(0, MERCHANT_ROW_LIMIT).find(isMerchantCandidate)
  if (!firstLine) return null
  const name = cleanMerchantName(firstLine.text)
  return countLetters(name) >= 3 ? { value: name, confidence: 0.6 } : null
}

function findKnownChain(rows: ReceiptRow[]): string | null {
  for (const row of rows) {
    const chain = KNOWN_CHAINS.find(({ pattern }) => pattern.test(row.folded))
    if (chain) return chain.name
  }
  return null
}

function isMerchantCandidate(row: ReceiptRow): boolean {
  const letters = countLetters(row.text)
  const visibleCharacters = row.text.replace(/\s/g, "").length
  return (
    letters >= 3 &&
    letters / visibleCharacters >= 0.5 &&
    row.amounts.length === 0 &&
    findDatesInLine(row.text).length === 0 &&
    !MERCHANT_REJECTED.test(row.folded) &&
    !POSTAL_CODE_LINE.test(row.text) &&
    !PHONE_NUMBER.test(row.text)
  )
}

function cleanMerchantName(line: string): string {
  return line.replace(STORE_NUMBER_SUFFIX, "").replace(EDGE_PUNCTUATION, "").replace(/^[^\p{L}\d]+|[^\p{L}\d'’.)]+$/gu, "")
}

type DateCandidate = { iso: string; hasFullYear: boolean }

function findReceiptDate(rows: ReceiptRow[], now: Date): ScoredText | null {
  const bounds = dateBounds(now)
  for (const row of rows) {
    const found = findDatesInLine(row.text).find(({ iso }) => iso >= bounds.oldest && iso <= bounds.latest)
    if (found) return { value: found.iso, confidence: found.hasFullYear ? 0.9 : 0.75 }
  }
  return null
}

function dateBounds(now: Date): { oldest: string; latest: string } {
  const safeNow = Number.isNaN(now.getTime()) ? new Date() : now
  const latest = new Date(safeNow.getFullYear(), safeNow.getMonth(), safeNow.getDate() + 1)
  const oldest = new Date(safeNow.getFullYear() - MAX_RECEIPT_AGE_YEARS, safeNow.getMonth(), safeNow.getDate())
  return { oldest: localIsoDate(oldest), latest: localIsoDate(latest) }
}

function localIsoDate(date: Date): string {
  return formatIsoDate(date.getFullYear(), date.getMonth() + 1, date.getDate())
}

function formatIsoDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

function findDatesInLine(line: string): DateCandidate[] {
  const isoMatches = [...line.matchAll(ISO_DATE)].map((match) => ({
    index: match.index,
    candidate: toDateCandidate(Number(match[1]), Number(match[2]), Number(match[3]), true),
  }))
  const dayFirstMatches = [...line.matchAll(DAY_FIRST_DATE)].map((match) => ({
    index: match.index,
    candidate: toDateCandidate(expandYear(match[4] ?? ""), Number(match[3]), Number(match[1]), match[4]?.length === 4),
  }))
  return [...isoMatches, ...dayFirstMatches]
    .sort((left, right) => left.index - right.index)
    .flatMap(({ candidate }) => (candidate ? [candidate] : []))
}

function expandYear(year: string): number {
  return year.length === 2 ? 2000 + Number(year) : Number(year)
}

function toDateCandidate(year: number, month: number, day: number, hasFullYear: boolean): DateCandidate | null {
  const date = new Date(Date.UTC(year, month - 1, day))
  const isRealDate =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  return isRealDate ? { iso: formatIsoDate(year, month, day), hasFullYear } : null
}
