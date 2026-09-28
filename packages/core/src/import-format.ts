import { decodeBytes } from "./text-decoding"
import type { ImportFormat } from "./types"

const FORMAT_SAMPLE_SIZE = 4096

export function detectImportFormat(bytes: Uint8Array): ImportFormat {
  const sample = decodeBytes(bytes.subarray(0, FORMAT_SAMPLE_SIZE), "utf-8").trimStart()
  return sample.startsWith("<?xml") || sample.includes("BkToCstmrStmt") ? "camt053" : "csv"
}
