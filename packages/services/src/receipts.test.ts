import { type ReceiptCreateInput, receiptCreateSchema } from "@centime/core"
import { TEST_CSV_PROFILES } from "@centime/core/test-fixtures"
import { categories, csvProfiles, csvProfileToRow, type Db, transactions } from "@centime/db"
import { beforeEach, describe, expect, it } from "bun:test"
import { ServiceError } from "./errors"
import { commitImport, deleteImport } from "./imports"
import {
  applyReceiptLinesAsSplits,
  createReceipt,
  deleteReceipt,
  findReceiptCandidates,
  getReceipt,
  labelSimilarity,
  linkReceipt,
  listReceipts,
  matchPendingReceipts,
  unlinkReceipt,
  updateReceipt,
} from "./receipts"
import { createTestAccount, createTestDb } from "./test-support/database"
import { createTransaction } from "./transaction-create"

const IBAN = "CH9300762011623852957"
const MISSING_ID = "8f0b6c1e-2d4a-4b7e-9a3c-5e6f7a8b9c0d"
const SHA256 = "0".repeat(64)

let db: Db
let accountId: string

function latin1(text: string): Uint8Array {
  return Uint8Array.from(text, (char) => char.charCodeAt(0))
}

const BAKERY_CSV = latin1(
  [
    "Compte;Date comptable;Libellé;Montant;Solde;Date valeur",
    `${IBAN};2026-03-03 00:00:00.0;Achat Boulangerie du Lac, Morges;-12.4;3088.1;2026-03-03 00:00:00.0`,
    "",
  ].join("\r\n"),
)

async function insertCategory(name: string): Promise<string> {
  const [category] = await db.insert(categories).values({ name, color: "#4a84c4" }).returning()
  if (!category) throw new Error("Catégorie de test impossible à créer")
  return category.id
}

async function insertTransaction(amount: number, bookingDate: string, rawLabel: string, account = accountId) {
  const created = await createTransaction(db, {
    accountId: account,
    bookingDate,
    rawLabel,
    merchant: null,
    amount,
    status: "booked",
    categoryId: null,
    fixedItemId: null,
    isTransfer: false,
  })
  return created.id
}

function addReceipt(input: Partial<ReceiptCreateInput> = {}) {
  return createReceipt(
    db,
    receiptCreateSchema.parse({
      accountId,
      mime: "image/jpeg",
      size: 1024,
      sha256: SHA256,
      capturedAt: "2026-03-03T10:15:00.000Z",
      ...input,
    }),
  )
}

beforeEach(async () => {
  db = await createTestDb()
  accountId = await createTestAccount(db)
})

describe("createReceipt", () => {
  it("stores a pending receipt with its parsed lines", async () => {
    const receipt = await addReceipt({ merchant: "Boulangerie", total: 4.7, lines: [{ label: "Pain", amount: 4.7 }] })

    expect(receipt).toMatchObject({ status: "pending", transactionId: null, merchant: "Boulangerie", total: 4.7 })
    expect(receipt.lines).toEqual([{ label: "Pain", amount: 4.7, categoryId: null }])
    expect(await getReceipt(db, { id: receipt.id })).toEqual(receipt)
  })

  it("links the receipt when a transaction is given", async () => {
    const transactionId = await insertTransaction(-4.7, "2026-03-03", "Boulangerie")

    const receipt = await addReceipt({ transactionId })

    expect(receipt).toMatchObject({ status: "linked", transactionId })
  })

  it("refuses an unknown account", async () => {
    await expect(addReceipt({ accountId: MISSING_ID })).rejects.toBeInstanceOf(ServiceError)
  })

  it("refuses a transaction of another account", async () => {
    const otherAccountId = await createTestAccount(db, IBAN)
    const transactionId = await insertTransaction(-4.7, "2026-03-03", "Boulangerie", otherAccountId)

    await expect(addReceipt({ transactionId })).rejects.toBeInstanceOf(ServiceError)
  })
})

describe("listReceipts", () => {
  it("filters by status and orders by capture time, newest first", async () => {
    const older = await addReceipt({ capturedAt: "2026-03-01T08:00:00.000Z" })
    const newer = await addReceipt({ capturedAt: "2026-03-05T08:00:00.000Z" })
    const ignored = await addReceipt({ capturedAt: "2026-03-06T08:00:00.000Z" })
    await updateReceipt(db, { id: ignored.id, status: "ignored" })

    const pending = await listReceipts(db, { status: "pending" })

    expect(pending.map((receipt) => receipt.id)).toEqual([newer.id, older.id])
  })

  it("leaves out deleted receipts", async () => {
    const receipt = await addReceipt()
    await deleteReceipt(db, { id: receipt.id })

    expect(await listReceipts(db)).toEqual([])
    await expect(getReceipt(db, { id: receipt.id })).rejects.toBeInstanceOf(ServiceError)
    await expect(deleteReceipt(db, { id: receipt.id })).rejects.toBeInstanceOf(ServiceError)
  })
})

describe("updateReceipt", () => {
  it("changes only the given fields", async () => {
    const receipt = await addReceipt({ merchant: "Boulangerie", note: "Petit-déjeuner" })

    const updated = await updateReceipt(db, { id: receipt.id, total: 8.2 })

    expect(updated).toMatchObject({ merchant: "Boulangerie", note: "Petit-déjeuner", total: 8.2 })
  })

  it("refuses the linked status without a transaction", async () => {
    const receipt = await addReceipt()

    await expect(updateReceipt(db, { id: receipt.id, status: "linked" })).rejects.toBeInstanceOf(ServiceError)
  })

  it("detaches the transaction when the receipt is ignored", async () => {
    const transactionId = await insertTransaction(-4.7, "2026-03-03", "Boulangerie")
    const receipt = await addReceipt({ transactionId })

    const updated = await updateReceipt(db, { id: receipt.id, status: "ignored" })

    expect(updated).toMatchObject({ status: "ignored", transactionId: null })
  })
})

describe("linkReceipt and unlinkReceipt", () => {
  it("links then unlinks a transaction", async () => {
    const transactionId = await insertTransaction(-4.7, "2026-03-03", "Boulangerie")
    const receipt = await addReceipt()

    expect(await linkReceipt(db, { id: receipt.id, transactionId })).toMatchObject({ status: "linked", transactionId })
    expect(await unlinkReceipt(db, { id: receipt.id })).toMatchObject({ status: "pending", transactionId: null })
  })

  it("refuses an unknown transaction", async () => {
    const receipt = await addReceipt()

    await expect(linkReceipt(db, { id: receipt.id, transactionId: MISSING_ID })).rejects.toBeInstanceOf(ServiceError)
  })
})

describe("labelSimilarity", () => {
  it("measures how much of the merchant appears in the labels, ignoring case and accents", () => {
    expect(labelSimilarity("Boulangerie du Lac", ["ACHAT BOULANGERIE DU LAC, MORGES"])).toBe(1)
    expect(labelSimilarity("Café du Lac", [null, "Achat Cafe Central"])).toBeCloseTo(1 / 3)
  })

  it("stays neutral without a merchant", () => {
    expect(labelSimilarity(null, ["Achat"])).toBe(0.5)
  })
})

describe("findReceiptCandidates", () => {
  it("scores transactions close in amount, date and label", async () => {
    const exact = await insertTransaction(-12.4, "2026-03-03", "Achat Boulangerie du Lac, Morges")
    const near = await insertTransaction(-12.43, "2026-03-04", "Kiosque")
    await insertTransaction(-12.4, "2026-03-08", "Trop tard")
    await insertTransaction(-13, "2026-03-03", "Trop cher")
    await insertTransaction(12.4, "2026-03-03", "Remboursement")
    const otherAccountId = await createTestAccount(db, IBAN)
    await insertTransaction(-12.4, "2026-03-03", "Autre compte", otherAccountId)
    const receipt = await addReceipt({ merchant: "Boulangerie du Lac", total: 12.4, receiptDate: "2026-03-03" })

    const candidates = await findReceiptCandidates(db, { id: receipt.id })

    expect(candidates.map((candidate) => [candidate.transactionId, candidate.score])).toEqual([
      [exact, 1],
      [near, 0.6],
    ])
    expect(candidates[1]).toMatchObject({ amountGap: 0.03, dayGap: 1 })
  })

  it("falls back on the capture date without a receipt date", async () => {
    const transactionId = await insertTransaction(-12.4, "2026-03-05", "Boulangerie")
    const receipt = await addReceipt({ total: 12.4, capturedAt: "2026-03-03T10:15:00.000Z" })

    const candidates = await findReceiptCandidates(db, { id: receipt.id })

    expect(candidates.map((candidate) => candidate.transactionId)).toEqual([transactionId])
  })

  it("returns nothing without a total", async () => {
    await insertTransaction(-12.4, "2026-03-03", "Boulangerie")
    const receipt = await addReceipt({ receiptDate: "2026-03-03" })

    expect(await findReceiptCandidates(db, { id: receipt.id })).toEqual([])
  })

  it("leaves out a transaction already linked to another receipt", async () => {
    const transactionId = await insertTransaction(-12.4, "2026-03-03", "Boulangerie")
    await addReceipt({ transactionId })
    const receipt = await addReceipt({ total: 12.4, receiptDate: "2026-03-03" })

    expect(await findReceiptCandidates(db, { id: receipt.id })).toEqual([])
  })
})

describe("matchPendingReceipts", () => {
  it("links a receipt with a single strong candidate", async () => {
    const transactionId = await insertTransaction(-12.4, "2026-03-03", "Achat Boulangerie du Lac")
    const receipt = await addReceipt({ merchant: "Boulangerie du Lac", total: 12.4, receiptDate: "2026-03-03" })

    expect(await matchPendingReceipts(db, { accountId })).toEqual([receipt.id])
    expect(await getReceipt(db, { id: receipt.id })).toMatchObject({ status: "linked", transactionId })
  })

  it("leaves an ambiguous receipt pending", async () => {
    await insertTransaction(-12.4, "2026-03-03", "Achat Boulangerie du Lac")
    await insertTransaction(-12.4, "2026-03-03", "Achat Boulangerie du Lac")
    const receipt = await addReceipt({ merchant: "Boulangerie du Lac", total: 12.4, receiptDate: "2026-03-03" })

    expect(await matchPendingReceipts(db, { accountId })).toEqual([])
    expect(await getReceipt(db, { id: receipt.id })).toMatchObject({ status: "pending", transactionId: null })
  })

  it("ignores receipts that are not pending", async () => {
    await insertTransaction(-12.4, "2026-03-03", "Achat Boulangerie du Lac")
    const receipt = await addReceipt({ total: 12.4, receiptDate: "2026-03-03" })
    await updateReceipt(db, { id: receipt.id, status: "ignored" })

    expect(await matchPendingReceipts(db, { accountId })).toEqual([])
  })
})

describe("applyReceiptLinesAsSplits", () => {
  let groceries: string
  let household: string

  beforeEach(async () => {
    groceries = await insertCategory("Courses")
    household = await insertCategory("Ménage")
  })

  async function linkedReceipt(amount: number, lines: ReceiptCreateInput["lines"]) {
    const transactionId = await insertTransaction(amount, "2026-03-03", "Supermarché")
    const receipt = await addReceipt({ transactionId, lines })
    return { transactionId, receipt }
  }

  it("splits the transaction by category of the receipt lines", async () => {
    const { transactionId, receipt } = await linkedReceipt(-42.5, [
      { label: "Pain", amount: 3.5, categoryId: groceries },
      { label: "Lessive", amount: 12, categoryId: household },
      { label: "Lait", amount: 1.5, categoryId: groceries },
      { label: "Shampoing", amount: 25.5, categoryId: household },
    ])

    const split = await applyReceiptLinesAsSplits(db, { id: receipt.id })

    expect(split).toMatchObject({ id: transactionId, isSplit: true })
    expect(split.splits.map((line) => [line.categoryId, line.amount, line.note])).toEqual([
      [groceries, -5, "Pain, Lait"],
      [household, -37.5, "Lessive, Shampoing"],
    ])
  })

  it("explains a total that differs from the transaction amount", async () => {
    const { receipt } = await linkedReceipt(-42.5, [
      { label: "Pain", amount: 15, categoryId: groceries },
      { label: "Lessive", amount: 25, categoryId: household },
    ])

    const applied = applyReceiptLinesAsSplits(db, { id: receipt.id })

    await expect(applied).rejects.toThrow(
      "Le total des lignes du ticket (40.00) ne correspond pas au montant de la transaction (42.50)",
    )
  })

  it("refuses lines of a single category", async () => {
    const { receipt } = await linkedReceipt(-10, [
      { label: "Pain", amount: 4, categoryId: groceries },
      { label: "Lait", amount: 6, categoryId: groceries },
    ])

    await expect(applyReceiptLinesAsSplits(db, { id: receipt.id })).rejects.toBeInstanceOf(ServiceError)
  })

  it("refuses a receipt without a transaction", async () => {
    const receipt = await addReceipt({ lines: [{ label: "Pain", amount: 4, categoryId: groceries }] })

    await expect(applyReceiptLinesAsSplits(db, { id: receipt.id })).rejects.toBeInstanceOf(ServiceError)
  })
})

describe("receipts and imports", () => {
  beforeEach(async () => {
    await db.insert(csvProfiles).values(TEST_CSV_PROFILES.map((profile) => ({ id: profile.id, ...csvProfileToRow(profile) })))
    accountId = await createTestAccount(db, IBAN)
  })

  it("links a pending receipt to a freshly imported transaction", async () => {
    const receipt = await addReceipt({ merchant: "Boulangerie du Lac", total: 12.4, receiptDate: "2026-03-03" })

    await commitImport(db, { bytes: BAKERY_CSV, fileName: "bank.csv" })

    const [imported] = await db.select().from(transactions)
    expect(await getReceipt(db, { id: receipt.id })).toMatchObject({ status: "linked", transactionId: imported?.id })
  })

  it("detaches receipts when the import of their transaction is deleted", async () => {
    const outcome = await commitImport(db, { bytes: BAKERY_CSV, fileName: "bank.csv" })
    const [imported] = await db.select().from(transactions)
    const receipt = await addReceipt({ transactionId: imported?.id ?? null })

    await deleteImport(db, { id: outcome.importId })

    expect(await getReceipt(db, { id: receipt.id })).toMatchObject({ status: "pending", transactionId: null })
  })
})
