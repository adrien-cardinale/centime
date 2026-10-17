import { CSV_DELIMITERS, type CsvDelimiter, type CsvEncoding } from "./csv-profile"
import { tokenizeCsv } from "./csv-tokenizer"

export type DetectedCsvFormat = { encoding: CsvEncoding; delimiter: CsvDelimiter }

const DETECTION_RECORDS = 20

type DelimiterScore = { delimiter: CsvDelimiter; matchingRows: number; width: number }

function utf8SequenceSize(leadByte: number): number {
  if (leadByte >= 0xf0) return 4
  if (leadByte >= 0xe0) return 3
  if (leadByte >= 0xc0) return 2
  return 1
}

function withoutTruncatedCharacter(bytes: Uint8Array): Uint8Array {
  for (let back = 1; back <= Math.min(3, bytes.length); back++) {
    const byte = bytes[bytes.length - back] ?? 0
    if ((byte & 0xc0) !== 0x80) {
      return utf8SequenceSize(byte) > back ? bytes.subarray(0, bytes.length - back) : bytes
    }
  }
  return bytes
}

export function detectCsvEncoding(bytes: Uint8Array): CsvEncoding {
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(withoutTruncatedCharacter(bytes))
    return "utf-8"
  } catch {
    return "iso-8859-1"
  }
}

function scoreDelimiter(text: string, delimiter: CsvDelimiter): DelimiterScore {
  const records = tokenizeCsv(text, delimiter).slice(0, DETECTION_RECORDS)
  const width = records[0]?.fields.length ?? 0
  if (width < 2) return { delimiter, matchingRows: 0, width }
  const matchingRows = records.filter((record) => record.fields.length === width).length
  return { delimiter, matchingRows, width }
}

function isBetter(candidate: DelimiterScore, best: DelimiterScore): boolean {
  if (candidate.matchingRows !== best.matchingRows) return candidate.matchingRows > best.matchingRows
  return candidate.width > best.width
}

export function detectCsvDelimiter(text: string): CsvDelimiter {
  const scores = CSV_DELIMITERS.map((delimiter) => scoreDelimiter(text, delimiter))
  return scores.reduce((best, candidate) => (isBetter(candidate, best) ? candidate : best)).delimiter
}

export function detectCsvFormat(bytes: Uint8Array): DetectedCsvFormat {
  const encoding = detectCsvEncoding(bytes)
  const text = new TextDecoder(encoding).decode(bytes)
  return { encoding, delimiter: detectCsvDelimiter(text) }
}
