import { XMLParser } from "fast-xml-parser"
import { normalizeAccountIdentifier } from "./account-identifier"
import type { ParseError, ParsedTransaction, ParseResult } from "./parsed-transaction"
import { decodeBytes } from "./text-decoding"
import type { TransactionStatus } from "./types"

type XmlNode = Record<string, unknown>

type StatementContext = {
  accountIdentifier: string | null
  currency: string
}

class CamtEntryError extends Error {}

const REPEATED_ELEMENTS = new Set(["Stmt", "Ntry", "NtryDtls", "TxDtls", "Ustrd"])
const ENCODING_DECLARATION = /encoding=["']([\w-]+)["']/
const AMOUNT_PATTERN = /^\d+(\.\d+)?$/
const DEFAULT_CURRENCY = "CHF"

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  isArray: (name) => REPEATED_ELEMENTS.has(name),
})

function isNode(value: unknown): value is XmlNode {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function child(node: unknown, ...path: string[]): unknown {
  let current = node
  for (const key of path) {
    const next: unknown = isNode(current) ? current[key] : undefined
    current = Array.isArray(next) ? next[0] : next
  }
  return current
}

function children(node: unknown, key: string): unknown[] {
  const value = isNode(node) ? node[key] : undefined
  if (value === undefined) return []
  return Array.isArray(value) ? value : [value]
}

function text(node: unknown): string | null {
  const value = isNode(node) ? node["#text"] : node
  if (typeof value !== "string" && typeof value !== "number") return null
  const trimmed = String(value).trim()
  return trimmed === "" ? null : trimmed
}

function attribute(node: unknown, name: string): string | null {
  return isNode(node) ? text(node[`@${name}`]) : null
}

function detectEncoding(bytes: Uint8Array): string {
  const prolog = decodeBytes(bytes.subarray(0, 200), "utf-8")
  return ENCODING_DECLARATION.exec(prolog)?.[1] ?? "utf-8"
}

function readDate(node: unknown): string | null {
  const value = text(child(node, "Dt")) ?? text(child(node, "DtTm"))
  return value ? value.slice(0, 10) : null
}

function readStatus(entry: unknown): TransactionStatus {
  const code = text(child(entry, "Sts", "Cd")) ?? text(child(entry, "Sts"))
  return code === "PDNG" ? "pending" : "booked"
}

function readLabel(entry: unknown): string | null {
  const details = child(entry, "NtryDtls", "TxDtls")
  return (
    text(child(entry, "AddtlNtryInf")) ??
    text(child(details, "AddtlTxInf")) ??
    text(child(details, "RmtInf", "Ustrd")) ??
    text(child(details, "RltdPties", "Cdtr", "Nm")) ??
    text(child(details, "RltdPties", "Dbtr", "Nm"))
  )
}

function readAmount(entry: unknown): number {
  const amount = text(child(entry, "Amt"))
  if (amount === null || !AMOUNT_PATTERN.test(amount)) throw new CamtEntryError(`Montant invalide : « ${amount ?? ""} »`)
  const isDebit = text(child(entry, "CdtDbtInd")) === "DBIT"
  const isReversal = text(child(entry, "RvslInd")) === "true"
  return isDebit !== isReversal ? -Number(amount) : Number(amount)
}

function toTransaction(entry: unknown, statement: StatementContext): ParsedTransaction {
  const bookingDate = readDate(child(entry, "BookgDt")) ?? readDate(child(entry, "ValDt"))
  if (bookingDate === null) throw new CamtEntryError("Date de comptabilisation absente")
  const rawLabel = readLabel(entry)
  if (rawLabel === null) throw new CamtEntryError("Libellé absent")
  return {
    accountIdentifier: statement.accountIdentifier,
    bookingDate,
    valueDate: readDate(child(entry, "ValDt")),
    rawLabel,
    merchant: null,
    amount: readAmount(entry),
    currency: attribute(child(entry, "Amt"), "Ccy") ?? statement.currency,
    status: readStatus(entry),
    balanceAfter: null,
    sourceRef: text(child(entry, "AcctSvcrRef")),
    providerCategory: null,
  }
}

function readStatementContext(statement: unknown): StatementContext {
  const identifier = text(child(statement, "Acct", "Id", "IBAN")) ?? text(child(statement, "Acct", "Id", "Othr", "Id"))
  return {
    accountIdentifier: identifier ? normalizeAccountIdentifier(identifier) : null,
    currency: text(child(statement, "Acct", "Ccy")) ?? DEFAULT_CURRENCY,
  }
}

function parseDocument(bytes: Uint8Array): unknown {
  const parsed: unknown = xmlParser.parse(decodeBytes(bytes, detectEncoding(bytes)), true)
  return parsed
}

function readStatements(bytes: Uint8Array): unknown[] | ParseError {
  try {
    const statements = children(child(parseDocument(bytes), "Document", "BkToCstmrStmt"), "Stmt")
    if (statements.length === 0) return { line: 1, message: "Aucun relevé camt.053 trouvé" }
    return statements
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    return { line: 1, message: `XML invalide : ${detail}` }
  }
}

export function parseCamt053(bytes: Uint8Array): ParseResult {
  const statements = readStatements(bytes)
  if (!Array.isArray(statements)) return { transactions: [], errors: [statements] }
  const result: ParseResult = { transactions: [], errors: [] }
  let entryNumber = 0
  for (const statement of statements) {
    const context = readStatementContext(statement)
    for (const entry of children(statement, "Ntry")) {
      entryNumber++
      try {
        result.transactions.push(toTransaction(entry, context))
      } catch (error) {
        if (!(error instanceof CamtEntryError)) throw error
        result.errors.push({ line: entryNumber, message: `Écriture ${entryNumber} : ${error.message}` })
      }
    }
  }
  return result
}
