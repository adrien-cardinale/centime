import {
  type AccountKind,
  assignOccurrences,
  computeTransactionFingerprint,
  type CsvProfile,
  detectCsvProfile,
  detectImportFormat,
  type ImportFormat,
  normalizeAccountIdentifier,
  parseCamt053,
  parseCsv,
  type ParseError,
  type ParsedTransaction,
  type ParseResult,
  type TransactionStatus,
  type WithOccurrence,
} from "@centime/core"
import { accounts, csvProfileFromRow, csvProfiles, type Db, type DbExecutor, imports, transactions } from "@centime/db"
import { and, desc, eq, inArray, isNull } from "drizzle-orm"
import { assignmentFor, type Categorizer, loadCategorizer } from "./categorize"
import { type Clock, nowIso, systemClock } from "./clock"
import { notFound, ServiceError } from "./errors"

export type ImportSource = {
  bytes: Uint8Array
  fileName: string
  profileId?: string | undefined
  accountId?: string | undefined
}

export type RowState = "new" | "duplicate" | "pendingToBooked"
export type AccountResolution = "auto" | "required"

type LocatedTransaction = WithOccurrence<ParsedTransaction> & { accountId: string | null; fingerprint: string | null }

export type AnalyzedRow = LocatedTransaction & { state: RowState; existingId: string | null }

export type ImportAnalysis = {
  format: ImportFormat
  profile: CsvProfile | null
  accountKind: AccountKind
  accountResolution: AccountResolution
  rows: AnalyzedRow[]
  errors: ParseError[]
}

export type ImportOutcome = {
  importId: string
  inserted: number
  skipped: number
  updated: number
  accountsCreated: number
}

type ParsedFile = {
  format: ImportFormat
  profile: CsvProfile | null
  accountKind: AccountKind
  result: ParseResult
}

type ExistingTransaction = { id: string; status: TransactionStatus; deletedAt: string | null }

const QUERY_CHUNK_SIZE = 500
const INSERT_CHUNK_SIZE = 100
const PREVIEW_ROW_LIMIT = 200

function chunk<Item>(items: Item[], size: number): Item[][] {
  const chunks: Item[][] = []
  for (let start = 0; start < items.length; start += size) chunks.push(items.slice(start, start + size))
  return chunks
}

async function loadActiveProfiles(db: DbExecutor): Promise<CsvProfile[]> {
  const rows = await db.select().from(csvProfiles).where(isNull(csvProfiles.deletedAt))
  return rows.flatMap((row) => {
    const profile = csvProfileFromRow(row)
    return profile ? [profile] : []
  })
}

async function selectProfile(db: DbExecutor, source: ImportSource): Promise<CsvProfile | null> {
  const profiles = await loadActiveProfiles(db)
  if (!source.profileId) return detectCsvProfile(source.bytes, profiles)
  const profile = profiles.find((candidate) => candidate.id === source.profileId)
  if (!profile) throw notFound("Profil CSV introuvable")
  return profile
}

async function parseFile(db: DbExecutor, source: ImportSource): Promise<ParsedFile> {
  const format = detectImportFormat(source.bytes)
  if (format === "camt053") {
    return { format, profile: null, accountKind: "bank", result: parseCamt053(source.bytes) }
  }
  const profile = await selectProfile(db, source)
  if (!profile) {
    const errors = [{ line: 1, message: "Format CSV non reconnu : choisissez un profil" }]
    return { format, profile, accountKind: "bank", result: { transactions: [], errors } }
  }
  return { format, profile, accountKind: profile.accountKind, result: parseCsv(source.bytes, profile) }
}

async function findFallbackAccount(db: DbExecutor, accountId: string | undefined): Promise<string | null> {
  if (!accountId) return null
  const [account] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.id, accountId), isNull(accounts.deletedAt)))
  if (!account) throw notFound("Compte introuvable")
  return account.id
}

async function loadAccountDirectory(db: DbExecutor): Promise<Map<string, string>> {
  const rows = await db.select({ id: accounts.id, identifier: accounts.identifier }).from(accounts)
  return new Map(rows.map((row) => [normalizeAccountIdentifier(row.identifier), row.id]))
}

function fingerprintOf(transaction: WithOccurrence<ParsedTransaction>, accountId: string | null): string | null {
  if (accountId === null) return null
  return computeTransactionFingerprint({
    accountId,
    bookingDate: transaction.bookingDate,
    amount: transaction.amount,
    label: transaction.rawLabel,
    occurrence: transaction.occurrence,
  })
}

async function locateTransactions(
  db: DbExecutor,
  parsed: ParsedTransaction[],
  fallbackAccountId: string | null,
): Promise<LocatedTransaction[]> {
  const directory = await loadAccountDirectory(db)
  return assignOccurrences(parsed).map((transaction) => {
    const identifier = transaction.accountIdentifier
    const accountId = identifier === null ? fallbackAccountId : (directory.get(identifier) ?? null)
    return { ...transaction, accountId, fingerprint: fingerprintOf(transaction, accountId) }
  })
}

async function findExistingTransactions(db: DbExecutor, fingerprints: string[]): Promise<Map<string, ExistingTransaction>> {
  const existing = new Map<string, ExistingTransaction>()
  for (const fingerprintChunk of chunk(fingerprints, QUERY_CHUNK_SIZE)) {
    const rows = await db
      .select({
        id: transactions.id,
        status: transactions.status,
        deletedAt: transactions.deletedAt,
        fingerprint: transactions.fingerprint,
      })
      .from(transactions)
      .where(inArray(transactions.fingerprint, fingerprintChunk))
    for (const row of rows) existing.set(row.fingerprint, { id: row.id, status: row.status, deletedAt: row.deletedAt })
  }
  return existing
}

function classify(transaction: LocatedTransaction, existing: ExistingTransaction | undefined): RowState {
  if (!existing || existing.deletedAt !== null) return "new"
  return existing.status === "pending" && transaction.status === "booked" ? "pendingToBooked" : "duplicate"
}

async function classifyTransactions(db: DbExecutor, located: LocatedTransaction[]): Promise<AnalyzedRow[]> {
  const fingerprints = located.flatMap((transaction) => (transaction.fingerprint ? [transaction.fingerprint] : []))
  const existingByFingerprint = await findExistingTransactions(db, fingerprints)
  return located.map((transaction) => {
    const existing = transaction.fingerprint ? existingByFingerprint.get(transaction.fingerprint) : undefined
    return { ...transaction, state: classify(transaction, existing), existingId: existing?.id ?? null }
  })
}

function resolutionFor(parsed: ParsedFile): AccountResolution {
  const hasAccountColumn = parsed.profile === null || parsed.profile.columns.account !== undefined
  const everyRowHasAccount = parsed.result.transactions.every((transaction) => transaction.accountIdentifier !== null)
  return hasAccountColumn && everyRowHasAccount ? "auto" : "required"
}

export async function analyzeImport(db: DbExecutor, source: ImportSource): Promise<ImportAnalysis> {
  const parsed = await parseFile(db, source)
  const fallbackAccountId = await findFallbackAccount(db, source.accountId)
  const located = await locateTransactions(db, parsed.result.transactions, fallbackAccountId)
  return {
    format: parsed.format,
    profile: parsed.profile,
    accountKind: parsed.accountKind,
    accountResolution: resolutionFor(parsed),
    rows: await classifyTransactions(db, located),
    errors: parsed.result.errors,
  }
}

function countByState(rows: AnalyzedRow[], state: RowState): number {
  return rows.filter((row) => row.state === state).length
}

export function summarizeAnalysis(analysis: ImportAnalysis) {
  return {
    total: analysis.rows.length,
    new: countByState(analysis.rows, "new"),
    duplicates: countByState(analysis.rows, "duplicate"),
    pendingToBooked: countByState(analysis.rows, "pendingToBooked"),
    errors: analysis.errors.length,
  }
}

function toPreviewRow(row: AnalyzedRow) {
  return {
    accountIdentifier: row.accountIdentifier,
    bookingDate: row.bookingDate,
    valueDate: row.valueDate,
    rawLabel: row.rawLabel,
    merchant: row.merchant,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    balanceAfter: row.balanceAfter,
    sourceRef: row.sourceRef,
    providerCategory: row.providerCategory,
    state: row.state,
  }
}

export type ImportPreview = ReturnType<typeof toImportPreview>

export function toImportPreview(analysis: ImportAnalysis) {
  return {
    format: analysis.format,
    profile: analysis.profile ? { id: analysis.profile.id, name: analysis.profile.name } : null,
    accountResolution: analysis.accountResolution,
    summary: summarizeAnalysis(analysis),
    rows: analysis.rows.slice(0, PREVIEW_ROW_LIMIT).map(toPreviewRow),
    errors: analysis.errors.slice(0, PREVIEW_ROW_LIMIT),
  }
}

function assertImportable(analysis: ImportAnalysis, source: ImportSource): void {
  if (analysis.format === "csv" && analysis.profile === null) {
    throw new ServiceError("Format CSV non reconnu : choisissez un profil")
  }
  if (analysis.accountResolution === "required" && !source.accountId) {
    throw new ServiceError("Choisissez le compte de destination")
  }
  if (analysis.rows.length === 0) {
    throw new ServiceError("Aucune transaction valide dans le fichier")
  }
}

function missingAccounts(analysis: ImportAnalysis): Map<string, string> {
  const missing = new Map<string, string>()
  for (const row of analysis.rows) {
    if (row.accountId === null && row.accountIdentifier !== null && !missing.has(row.accountIdentifier)) {
      missing.set(row.accountIdentifier, row.currency)
    }
  }
  return missing
}

async function createMissingAccounts(db: DbExecutor, analysis: ImportAnalysis): Promise<number> {
  const missing = missingAccounts(analysis)
  if (missing.size === 0) return 0
  const values = [...missing].map(([identifier, currency]) => ({
    name: identifier,
    kind: analysis.accountKind,
    identifier,
    currency,
  }))
  await db.insert(accounts).values(values)
  return missing.size
}

const UNASSIGNED = { categoryId: null, fixedItemId: null, isTransfer: false }

function toNewTransaction(row: AnalyzedRow, importId: string, categorize: Categorizer) {
  if (row.accountId === null || row.fingerprint === null) throw new Error("Transaction sans compte résolu")
  return {
    ...assignmentFor(UNASSIGNED, categorize(row)),
    accountId: row.accountId,
    bookingDate: row.bookingDate,
    valueDate: row.valueDate,
    rawLabel: row.rawLabel,
    merchant: row.merchant,
    providerCategory: row.providerCategory,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    importId,
    sourceRef: row.sourceRef,
    fingerprint: row.fingerprint,
    balanceAfter: row.balanceAfter,
  }
}

async function insertNewTransactions(db: DbExecutor, rows: AnalyzedRow[], importId: string): Promise<void> {
  const categorize = await loadCategorizer(db)
  const unseen = rows.filter((row) => row.existingId === null)
  for (const rowChunk of chunk(unseen, INSERT_CHUNK_SIZE)) {
    await db.insert(transactions).values(rowChunk.map((row) => toNewTransaction(row, importId, categorize)))
  }
  for (const row of rows) {
    if (row.existingId === null) continue
    await db
      .update(transactions)
      .set({ ...toNewTransaction(row, importId, categorize), deletedAt: null })
      .where(eq(transactions.id, row.existingId))
  }
}

async function promotePendingTransactions(db: DbExecutor, rows: AnalyzedRow[], importId: string): Promise<void> {
  for (const row of rows) {
    if (row.existingId === null) continue
    await db
      .update(transactions)
      .set({
        status: "booked",
        valueDate: row.valueDate,
        balanceAfter: row.balanceAfter,
        sourceRef: row.sourceRef,
        importId,
      })
      .where(eq(transactions.id, row.existingId))
  }
}

async function recordImport(db: DbExecutor, source: ImportSource, analysis: ImportAnalysis): Promise<ImportOutcome> {
  const summary = summarizeAnalysis(analysis)
  const [created] = await db
    .insert(imports)
    .values({
      fileName: source.fileName,
      format: analysis.format,
      profileId: analysis.profile?.id ?? null,
      insertedCount: summary.new,
      skippedCount: summary.duplicates,
      updatedCount: summary.pendingToBooked,
    })
    .returning({ id: imports.id })
  if (!created) throw new Error("Enregistrement de l'import impossible")
  return {
    importId: created.id,
    inserted: summary.new,
    skipped: summary.duplicates,
    updated: summary.pendingToBooked,
    accountsCreated: 0,
  }
}

export async function commitImport(db: Db, source: ImportSource): Promise<ImportOutcome> {
  return db.transaction(async (tx) => {
    const preliminary = await analyzeImport(tx, source)
    assertImportable(preliminary, source)
    const accountsCreated = await createMissingAccounts(tx, preliminary)
    const analysis = accountsCreated > 0 ? await analyzeImport(tx, source) : preliminary
    const outcome = await recordImport(tx, source, analysis)
    await insertNewTransactions(tx, analysis.rows.filter((row) => row.state === "new"), outcome.importId)
    await promotePendingTransactions(tx, analysis.rows.filter((row) => row.state === "pendingToBooked"), outcome.importId)
    return { ...outcome, accountsCreated }
  })
}

export async function previewImport(db: DbExecutor, source: ImportSource): Promise<ImportPreview> {
  return toImportPreview(await analyzeImport(db, source))
}

export async function deleteImport(db: Db, { id }: { id: string }, clock: Clock = systemClock) {
  const deletedAt = nowIso(clock)
  return db.transaction(async (tx) => {
    const [deleted] = await tx
      .update(imports)
      .set({ deletedAt })
      .where(and(eq(imports.id, id), isNull(imports.deletedAt)))
      .returning({ id: imports.id })
    if (!deleted) throw notFound("Import introuvable")
    const removed = await tx
      .update(transactions)
      .set({ deletedAt })
      .where(and(eq(transactions.importId, id), isNull(transactions.deletedAt)))
      .returning({ id: transactions.id })
    return { id: deleted.id, deletedTransactions: removed.length }
  })
}

export function listImports(db: DbExecutor) {
  return db
    .select({
      id: imports.id,
      fileName: imports.fileName,
      format: imports.format,
      profileId: imports.profileId,
      profileName: csvProfiles.name,
      importedAt: imports.importedAt,
      insertedCount: imports.insertedCount,
      skippedCount: imports.skippedCount,
      updatedCount: imports.updatedCount,
    })
    .from(imports)
    .leftJoin(csvProfiles, eq(imports.profileId, csvProfiles.id))
    .where(isNull(imports.deletedAt))
    .orderBy(desc(imports.importedAt))
}
