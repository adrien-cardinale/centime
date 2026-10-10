import {
  MAX_SPLIT_NOTE_LENGTH,
  MIN_SPLITS,
  type ReceiptCreate,
  type ReceiptFilter,
  type ReceiptLine,
  receiptLineSchema,
  type ReceiptLink,
  type ReceiptStatus,
  type ReceiptUpdate,
  splitsBalance,
  type TransactionSplitInput,
  transactionSplitSchema,
} from "@centime/core"
import { accounts, type Db, type DbExecutor, type ReceiptRow, receipts, transactions } from "@centime/db"
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lte, ne } from "drizzle-orm"
import { z } from "zod"
import { isActiveCategory } from "./categories"
import { type Clock, nowIso, systemClock } from "./clock"
import { notFound, ServiceError } from "./errors"
import { splitTransaction } from "./transaction-splits"

const NOT_FOUND = "Ticket introuvable"
const ACCOUNT_NOT_FOUND = "Compte introuvable"
const TRANSACTION_NOT_FOUND = "Transaction introuvable"
const UNKNOWN_CATEGORY = "Catégorie introuvable"
const OTHER_ACCOUNT = "La transaction n'appartient pas au compte du ticket"
const LINK_REQUIRED = "Associez d'abord le ticket à une transaction"
const NOT_LINKED = "Le ticket n'est associé à aucune transaction"
const NO_LINES = "Le ticket ne contient aucune ligne"
const SINGLE_CATEGORY = "Les lignes du ticket doivent couvrir au moins deux catégories pour répartir la transaction"
const INVALID_LINES = "Lignes du ticket invalides"

const AMOUNT_TOLERANCE = 0.05
const DAY_TOLERANCE = 3
const AMOUNT_WEIGHT = 0.5
const DATE_WEIGHT = 0.3
const LABEL_WEIGHT = 0.2
const NEUTRAL_LABEL_SCORE = 0.5
const AUTO_LINK_SCORE = 0.8
const AMBIGUOUS_SCORE = 0.5
const DAY_MS = 24 * 60 * 60 * 1000
const QUERY_CHUNK_SIZE = 500

export type ReceiptItem = Omit<ReceiptRow, "linesJson"> & { lines: ReceiptLine[] | null }

export type ReceiptChanges = ReceiptUpdate & { id: string }

export type ReceiptCandidateOptions = {
  amountTolerance?: number | undefined
  dayTolerance?: number | undefined
}

export type ReceiptCandidateQuery = ReceiptCandidateOptions & { id: string }

export type ReceiptCandidate = {
  transactionId: string
  bookingDate: string
  rawLabel: string
  merchant: string | null
  amount: number
  currency: string
  amountGap: number
  dayGap: number
  score: number
}

const storedLinesSchema = z.array(receiptLineSchema)

function parseLines(linesJson: string | null): ReceiptLine[] | null {
  if (linesJson === null) return null
  try {
    const parsed = storedLinesSchema.safeParse(JSON.parse(linesJson))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

function serializeLines(lines: ReceiptLine[] | null): string | null {
  return lines === null ? null : JSON.stringify(lines)
}

function toItem({ linesJson, ...row }: ReceiptRow): ReceiptItem {
  return { ...row, lines: parseLines(linesJson) }
}

function activeReceipt(id: string) {
  return and(eq(receipts.id, id), isNull(receipts.deletedAt))
}

async function requireReceipt(db: DbExecutor, id: string): Promise<ReceiptRow> {
  const [row] = await db.select().from(receipts).where(activeReceipt(id))
  if (!row) throw notFound(NOT_FOUND)
  return row
}

async function requireAccount(db: DbExecutor, accountId: string): Promise<void> {
  const [account] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.id, accountId), isNull(accounts.deletedAt)))
  if (!account) throw notFound(ACCOUNT_NOT_FOUND)
}

async function requireTransaction(db: DbExecutor, transactionId: string) {
  const [transaction] = await db
    .select({ id: transactions.id, accountId: transactions.accountId, amount: transactions.amount })
    .from(transactions)
    .where(and(eq(transactions.id, transactionId), isNull(transactions.deletedAt)))
  if (!transaction) throw notFound(TRANSACTION_NOT_FOUND)
  return transaction
}

async function requireAccountTransaction(db: DbExecutor, transactionId: string, accountId: string): Promise<void> {
  const transaction = await requireTransaction(db, transactionId)
  if (transaction.accountId !== accountId) throw new ServiceError(OTHER_ACCOUNT)
}

async function checkLineCategories(db: DbExecutor, lines: ReceiptLine[] | null | undefined): Promise<void> {
  const categoryIds = new Set((lines ?? []).flatMap((line) => (line.categoryId === null ? [] : [line.categoryId])))
  for (const categoryId of categoryIds) {
    if (!(await isActiveCategory(db, categoryId))) throw new ServiceError(UNKNOWN_CATEGORY)
  }
}

export async function createReceipt(db: Db, input: ReceiptCreate): Promise<ReceiptItem> {
  return db.transaction(async (tx) => {
    await requireAccount(tx, input.accountId)
    if (input.transactionId !== null) await requireAccountTransaction(tx, input.transactionId, input.accountId)
    await checkLineCategories(tx, input.lines)
    const [created] = await tx
      .insert(receipts)
      .values({
        accountId: input.accountId,
        transactionId: input.transactionId,
        capturedAt: input.capturedAt,
        mime: input.mime,
        size: input.size,
        sha256: input.sha256,
        merchant: input.merchant,
        total: input.total,
        receiptDate: input.receiptDate,
        note: input.note,
        linesJson: serializeLines(input.lines),
        status: input.transactionId === null ? "pending" : "linked",
      })
      .returning()
    if (!created) throw new Error("Insertion du ticket impossible")
    return toItem(created)
  })
}

export async function getReceipt(db: DbExecutor, { id }: { id: string }): Promise<ReceiptItem> {
  return toItem(await requireReceipt(db, id))
}

export async function listReceipts(db: DbExecutor, filter: ReceiptFilter = {}): Promise<ReceiptItem[]> {
  const rows = await db
    .select()
    .from(receipts)
    .where(
      and(
        isNull(receipts.deletedAt),
        filter.accountId === undefined ? undefined : eq(receipts.accountId, filter.accountId),
        filter.status === undefined ? undefined : eq(receipts.status, filter.status),
        filter.transactionId === undefined ? undefined : eq(receipts.transactionId, filter.transactionId),
      ),
    )
    .orderBy(desc(receipts.capturedAt), desc(receipts.createdAt))
  return rows.map(toItem)
}

function statusChanges(current: ReceiptRow, status: ReceiptStatus | undefined) {
  if (status === undefined) return {}
  if (status === "linked") {
    if (current.transactionId === null) throw new ServiceError(LINK_REQUIRED)
    return { status }
  }
  return { status, transactionId: null }
}

function toChanges(current: ReceiptRow, patch: ReceiptUpdate) {
  return {
    ...(patch.merchant !== undefined && { merchant: patch.merchant }),
    ...(patch.total !== undefined && { total: patch.total }),
    ...(patch.receiptDate !== undefined && { receiptDate: patch.receiptDate }),
    ...(patch.note !== undefined && { note: patch.note }),
    ...(patch.lines !== undefined && { linesJson: serializeLines(patch.lines) }),
    ...statusChanges(current, patch.status),
  }
}

export async function updateReceipt(db: Db, { id, ...patch }: ReceiptChanges): Promise<ReceiptItem> {
  return db.transaction(async (tx) => {
    const current = await requireReceipt(tx, id)
    await checkLineCategories(tx, patch.lines)
    const [updated] = await tx.update(receipts).set(toChanges(current, patch)).where(activeReceipt(id)).returning()
    if (!updated) throw notFound(NOT_FOUND)
    return toItem(updated)
  })
}

export async function deleteReceipt(db: DbExecutor, { id }: { id: string }, clock: Clock = systemClock) {
  const [deleted] = await db
    .update(receipts)
    .set({ deletedAt: nowIso(clock) })
    .where(activeReceipt(id))
    .returning({ id: receipts.id })
  if (!deleted) throw notFound(NOT_FOUND)
  return { id: deleted.id }
}

export async function linkReceipt(db: Db, { id, transactionId }: ReceiptLink): Promise<ReceiptItem> {
  return db.transaction(async (tx) => {
    const receipt = await requireReceipt(tx, id)
    await requireAccountTransaction(tx, transactionId, receipt.accountId)
    const [linked] = await tx
      .update(receipts)
      .set({ transactionId, status: "linked" })
      .where(activeReceipt(id))
      .returning()
    if (!linked) throw notFound(NOT_FOUND)
    return toItem(linked)
  })
}

export async function unlinkReceipt(db: DbExecutor, { id }: { id: string }): Promise<ReceiptItem> {
  const [unlinked] = await db
    .update(receipts)
    .set({ transactionId: null, status: "pending" })
    .where(activeReceipt(id))
    .returning()
  if (!unlinked) throw notFound(NOT_FOUND)
  return toItem(unlinked)
}

export async function detachReceipts(db: DbExecutor, transactionIds: string[]): Promise<void> {
  for (let start = 0; start < transactionIds.length; start += QUERY_CHUNK_SIZE) {
    await db
      .update(receipts)
      .set({ transactionId: null, status: "pending" })
      .where(
        and(inArray(receipts.transactionId, transactionIds.slice(start, start + QUERY_CHUNK_SIZE)), isNull(receipts.deletedAt)),
      )
  }
}

function toCents(amount: number): number {
  return Math.round(amount * 100)
}

function shiftIsoDate(date: string, days: number): string {
  const shifted = new Date(`${date}T00:00:00Z`)
  shifted.setUTCDate(shifted.getUTCDate() + days)
  return shifted.toISOString().slice(0, 10)
}

function daysBetween(left: string, right: string): number {
  return Math.round(Math.abs(Date.parse(`${left}T00:00:00Z`) - Date.parse(`${right}T00:00:00Z`)) / DAY_MS)
}

function referenceDateOf(receipt: ReceiptRow): string {
  return receipt.receiptDate ?? receipt.capturedAt.slice(0, 10)
}

function tokensOf(text: string): Set<string> {
  const words = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
  return new Set(words.filter((word) => word.length >= 2 && !/^\d+$/.test(word)))
}

export function labelSimilarity(merchant: string | null, labels: readonly (string | null)[]): number {
  const wanted = tokensOf(merchant ?? "")
  if (wanted.size === 0) return NEUTRAL_LABEL_SCORE
  const available = tokensOf(labels.filter((label) => label !== null).join(" "))
  const shared = [...wanted].filter((token) => available.has(token)).length
  return shared / wanted.size
}

function closeness(gap: number, tolerance: number): number {
  if (tolerance <= 0) return gap === 0 ? 1 : 0
  return Math.max(0, 1 - gap / (tolerance * 2))
}

function roundScore(score: number): number {
  return Math.round(score * 1000) / 1000
}

async function transactionsLinkedElsewhere(db: DbExecutor, receipt: ReceiptRow): Promise<Set<string>> {
  const rows = await db
    .select({ transactionId: receipts.transactionId })
    .from(receipts)
    .where(
      and(
        eq(receipts.accountId, receipt.accountId),
        eq(receipts.status, "linked"),
        isNotNull(receipts.transactionId),
        isNull(receipts.deletedAt),
        ne(receipts.id, receipt.id),
      ),
    )
  return new Set(rows.flatMap((row) => (row.transactionId === null ? [] : [row.transactionId])))
}

async function candidatesFor(
  db: DbExecutor,
  receipt: ReceiptRow,
  options: ReceiptCandidateOptions,
): Promise<ReceiptCandidate[]> {
  if (receipt.total === null) return []
  const amountTolerance = options.amountTolerance ?? AMOUNT_TOLERANCE
  const dayTolerance = options.dayTolerance ?? DAY_TOLERANCE
  const referenceDate = referenceDateOf(receipt)
  const expectedCents = -toCents(receipt.total)
  const taken = await transactionsLinkedElsewhere(db, receipt)
  const rows = await db
    .select({
      id: transactions.id,
      bookingDate: transactions.bookingDate,
      rawLabel: transactions.rawLabel,
      merchant: transactions.merchant,
      amount: transactions.amount,
      currency: transactions.currency,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.accountId, receipt.accountId),
        isNull(transactions.deletedAt),
        gte(transactions.bookingDate, shiftIsoDate(referenceDate, -dayTolerance)),
        lte(transactions.bookingDate, shiftIsoDate(referenceDate, dayTolerance)),
      ),
    )
  return rows
    .filter((row) => !taken.has(row.id))
    .map((row) => {
      const amountGap = Math.abs(toCents(row.amount) - expectedCents) / 100
      const dayGap = daysBetween(row.bookingDate, referenceDate)
      const score =
        AMOUNT_WEIGHT * closeness(amountGap, amountTolerance) +
        DATE_WEIGHT * closeness(dayGap, dayTolerance) +
        LABEL_WEIGHT * labelSimilarity(receipt.merchant, [row.merchant, row.rawLabel])
      return {
        transactionId: row.id,
        bookingDate: row.bookingDate,
        rawLabel: row.rawLabel,
        merchant: row.merchant,
        amount: row.amount,
        currency: row.currency,
        amountGap,
        dayGap,
        score: roundScore(score),
      }
    })
    .filter((candidate) => toCents(candidate.amountGap) <= toCents(amountTolerance))
    .sort((left, right) => right.score - left.score || left.dayGap - right.dayGap)
}

export async function findReceiptCandidates(
  db: DbExecutor,
  { id, ...options }: ReceiptCandidateQuery,
): Promise<ReceiptCandidate[]> {
  return candidatesFor(db, await requireReceipt(db, id), options)
}

function automaticMatchOf(candidates: ReceiptCandidate[]): string | null {
  const [best, runnerUp] = candidates
  if (!best || best.score < AUTO_LINK_SCORE) return null
  if (runnerUp && runnerUp.score >= AMBIGUOUS_SCORE) return null
  return best.transactionId
}

export async function matchPendingReceipts(db: DbExecutor, { accountId }: { accountId: string }): Promise<string[]> {
  const pending = await db
    .select()
    .from(receipts)
    .where(
      and(
        eq(receipts.accountId, accountId),
        eq(receipts.status, "pending"),
        isNotNull(receipts.total),
        isNull(receipts.deletedAt),
      ),
    )
    .orderBy(asc(receipts.capturedAt))
  const linkedIds: string[] = []
  for (const receipt of pending) {
    const transactionId = automaticMatchOf(await candidatesFor(db, receipt, {}))
    if (transactionId === null) continue
    await db
      .update(receipts)
      .set({ transactionId, status: "linked" })
      .where(and(eq(receipts.id, receipt.id), eq(receipts.status, "pending")))
    linkedIds.push(receipt.id)
  }
  return linkedIds
}

function noteOf(labels: string[]): string {
  const joined = labels.join(", ")
  return joined.length <= MAX_SPLIT_NOTE_LENGTH ? joined : `${joined.slice(0, MAX_SPLIT_NOTE_LENGTH - 1)}…`
}

function splitsFromLines(lines: ReceiptLine[]): TransactionSplitInput["splits"] {
  const groups = new Map<string | null, { cents: number; labels: string[] }>()
  for (const line of lines) {
    const group = groups.get(line.categoryId) ?? { cents: 0, labels: [] }
    groups.set(line.categoryId, { cents: group.cents - toCents(line.amount), labels: [...group.labels, line.label] })
  }
  return [...groups]
    .filter(([, group]) => group.cents !== 0)
    .map(([categoryId, group]) => ({ categoryId, amount: group.cents / 100, note: noteOf(group.labels) }))
}

function formatAmount(amount: number): string {
  return amount.toFixed(2)
}

function linesMismatch(linesTotal: number, transactionAmount: number): string {
  const lines = formatAmount(linesTotal)
  const transaction = formatAmount(Math.abs(transactionAmount))
  return `Le total des lignes du ticket (${lines}) ne correspond pas au montant de la transaction (${transaction})`
}

export async function applyReceiptLinesAsSplits(db: Db, { id }: { id: string }, clock: Clock = systemClock) {
  const receipt = await requireReceipt(db, id)
  if (receipt.status !== "linked" || receipt.transactionId === null) throw new ServiceError(NOT_LINKED)
  const lines = parseLines(receipt.linesJson)
  if (!lines || lines.length === 0) throw new ServiceError(NO_LINES)
  const transaction = await requireTransaction(db, receipt.transactionId)
  const signedLines = lines.map((line) => ({ amount: -line.amount }))
  if (!splitsBalance(transaction.amount, signedLines)) {
    const linesTotal = lines.reduce((sum, line) => sum + toCents(line.amount), 0) / 100
    throw new ServiceError(linesMismatch(linesTotal, transaction.amount))
  }
  const splits = splitsFromLines(lines)
  if (splits.length < MIN_SPLITS) throw new ServiceError(SINGLE_CATEGORY)
  const parsed = transactionSplitSchema.safeParse({ transactionId: transaction.id, splits })
  if (!parsed.success) throw new ServiceError(parsed.error.issues[0]?.message ?? INVALID_LINES)
  return splitTransaction(db, parsed.data, clock)
}
