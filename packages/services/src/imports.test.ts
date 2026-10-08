import type { CsvProfileInput } from "@centime/core"
import { TEST_CSV_PROFILES } from "@centime/core/test-fixtures"
import { categories, csvProfiles, csvProfileToRow, type Db, rules, transactions } from "@centime/db"
import { beforeEach, describe, expect, it } from "bun:test"
import { ServiceError } from "./errors"
import { analyzeImport, commitImport, deleteImport, listImports, summarizeAnalysis } from "./imports"
import { createTestDb } from "./test-support/database"

const IBAN = "CH9300762011623852957"

function latin1(text: string): Uint8Array {
  return Uint8Array.from(text, (char) => char.charCodeAt(0))
}

function utf8(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

const BANK_CSV = latin1(
  [
    "Compte;Date comptable;Libellé;Montant;Solde;Date valeur",
    `${IBAN};2026-03-02 00:00:00.0;Crédit Société Fictive SA;2500.5;3100.5;2026-03-02 00:00:00.0`,
    `${IBAN};2026-03-03 00:00:00.0;Paiement mobile DUPONT, JEAN;-20;3080.5;2026-03-03 00:00:00.0`,
    `${IBAN};2026-03-03 00:00:00.0;Paiement mobile DUPONT, JEAN;-20;3060.5;2026-03-03 00:00:00.0`,
    "",
  ].join("\r\n"),
)

const CAMT_XML = utf8(`<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08"><BkToCstmrStmt><Stmt>
<Acct><Id><IBAN>${IBAN}</IBAN></Id><Ccy>CHF</Ccy></Acct>
<Ntry><Amt Ccy="CHF">2500.50</Amt><CdtDbtInd>CRDT</CdtDbtInd><Sts><Cd>BOOK</Cd></Sts><BookgDt><Dt>2026-03-02</Dt></BookgDt><AcctSvcrRef>R1</AcctSvcrRef><AddtlNtryInf>Crédit Société Fictive SA</AddtlNtryInf></Ntry>
<Ntry><Amt Ccy="CHF">20</Amt><CdtDbtInd>DBIT</CdtDbtInd><Sts><Cd>BOOK</Cd></Sts><BookgDt><Dt>2026-03-03</Dt></BookgDt><AcctSvcrRef>R2</AcctSvcrRef><AddtlNtryInf>Paiement mobile DUPONT, JEAN</AddtlNtryInf></Ntry>
<Ntry><Amt Ccy="CHF">20</Amt><CdtDbtInd>DBIT</CdtDbtInd><Sts><Cd>BOOK</Cd></Sts><BookgDt><Dt>2026-03-03</Dt></BookgDt><AcctSvcrRef>R3</AcctSvcrRef><AddtlNtryInf>Paiement mobile DUPONT, JEAN</AddtlNtryInf></Ntry>
<Ntry><Amt Ccy="CHF">8.90</Amt><CdtDbtInd>DBIT</CdtDbtInd><Sts><Cd>BOOK</Cd></Sts><BookgDt><Dt>2026-03-04</Dt></BookgDt><AcctSvcrRef>R4</AcctSvcrRef><AddtlNtryInf>Achat Kiosque Fictif</AddtlNtryInf></Ntry>
</Stmt></BkToCstmrStmt></Document>`)

const CARD_HEADER =
  "Date transaction,Libellé,Marchand,Numéro de carte,Devise,Montant,Devise d'origine,Montant d'origine,Sens,Statut,Catégorie,Code catégorie"

function cardCsv(status: string): Uint8Array {
  return utf8(
    `${CARD_HEADER}\n"25.03.2026","EPICERIE FICTIVE, VILLEFICTIVE","Epicerie Fictive","5555 12** **** 3456","CHF","11.95","","","Débit","${status}","Alimentation","GROCERY"\n`,
  )
}

const PROFILE_WITHOUT_ACCOUNT: CsvProfileInput = {
  name: "Sans compte",
  accountKind: "bank",
  encoding: "utf-8",
  delimiter: ";",
  hasHeader: true,
  dateFormat: "yyyy-MM-dd",
  decimalSeparator: ".",
  defaultCurrency: "CHF",
  columns: { date: "Date", label: "Texte" },
  amount: { mode: "signed", column: "Montant" },
  detect: { requiredHeaders: ["Date", "Texte", "Montant"] },
}

let db: Db

beforeEach(async () => {
  db = await createTestDb()
  await db.insert(csvProfiles).values(TEST_CSV_PROFILES.map((profile) => ({ id: profile.id, ...csvProfileToRow(profile) })))
})

describe("import service", () => {
  it("imports a bank CSV and creates the account", async () => {
    const outcome = await commitImport(db, { bytes: BANK_CSV, fileName: "bank.csv" })
    expect(outcome).toMatchObject({ inserted: 3, skipped: 0, updated: 0, accountsCreated: 1 })
    const account = await db.query.accounts.findFirst()
    expect(account).toMatchObject({ identifier: IBAN, kind: "bank" })
  })

  it("skips transactions already imported from the CSV when the camt.053 file arrives", async () => {
    await commitImport(db, { bytes: BANK_CSV, fileName: "bank.csv" })
    const analysis = await analyzeImport(db, { bytes: CAMT_XML, fileName: "camt.xml" })
    expect(summarizeAnalysis(analysis)).toMatchObject({ total: 4, new: 1, duplicates: 3 })
    const outcome = await commitImport(db, { bytes: CAMT_XML, fileName: "camt.xml" })
    expect(outcome).toMatchObject({ inserted: 1, skipped: 3, accountsCreated: 0 })
  })

  it("promotes a pending card transaction once it is booked", async () => {
    await commitImport(db, { bytes: cardCsv("En attente"), fileName: "card-1.csv" })
    const outcome = await commitImport(db, { bytes: cardCsv("Comptabilisée"), fileName: "card-2.csv" })
    expect(outcome).toMatchObject({ inserted: 0, updated: 1 })
    const stored = await db.select().from(transactions)
    expect(stored.map((transaction) => transaction.status)).toEqual(["booked"])
  })

  it("keeps a promoted transaction when the promoting import is deleted", async () => {
    const first = await commitImport(db, { bytes: cardCsv("En attente"), fileName: "card-1.csv" })
    const second = await commitImport(db, { bytes: cardCsv("Comptabilisée"), fileName: "card-2.csv" })
    const result = await deleteImport(db, { id: second.importId })
    expect(result.deletedTransactions).toBe(0)
    const [stored] = await db.select().from(transactions)
    expect(stored).toMatchObject({ status: "booked", deletedAt: null, importId: first.importId })
  })

  it("requires an account when the profile has no account column", async () => {
    await db.insert(csvProfiles).values(csvProfileToRow(PROFILE_WITHOUT_ACCOUNT))
    const bytes = utf8("Date;Texte;Montant\n2026-03-01;Loyer;-1200\n")
    const analysis = await analyzeImport(db, { bytes, fileName: "loyer.csv" })
    expect(analysis.accountResolution).toBe("required")
    await expect(commitImport(db, { bytes, fileName: "loyer.csv" })).rejects.toBeInstanceOf(ServiceError)
  })

  it("deletes an import with its transactions only", async () => {
    await commitImport(db, { bytes: BANK_CSV, fileName: "bank.csv" })
    const camt = await commitImport(db, { bytes: CAMT_XML, fileName: "camt.xml" })
    const result = await deleteImport(db, { id: camt.importId })
    expect(result).toEqual({ id: camt.importId, deletedTransactions: 1 })
    const stored = await db.select().from(transactions)
    expect(stored.filter((transaction) => transaction.deletedAt === null)).toHaveLength(3)
    expect((await listImports(db)).map((entry) => entry.fileName)).toEqual(["bank.csv"])
    await expect(deleteImport(db, { id: camt.importId })).rejects.toBeInstanceOf(ServiceError)
  })

  it("imports again the transactions of a deleted import", async () => {
    const first = await commitImport(db, { bytes: BANK_CSV, fileName: "bank.csv" })
    await deleteImport(db, { id: first.importId })
    const analysis = await analyzeImport(db, { bytes: BANK_CSV, fileName: "bank.csv" })
    expect(summarizeAnalysis(analysis)).toMatchObject({ new: 3, duplicates: 0 })
    const second = await commitImport(db, { bytes: BANK_CSV, fileName: "bank.csv" })
    expect(second).toMatchObject({ inserted: 3, skipped: 0 })
    const stored = await db.select().from(transactions)
    expect(stored).toHaveLength(3)
    expect(stored.every((transaction) => transaction.deletedAt === null && transaction.importId === second.importId)).toBe(true)
  })

  it("categorizes new transactions with the active rules", async () => {
    const [food] = await db.insert(categories).values({ name: "Alimentation", color: "#5b9a4f" }).returning()
    await db.insert(rules).values([
      { pattern: "alimentation", matchKind: "contains", field: "provider_category", categoryId: food?.id ?? null },
      { pattern: "Paiement mobile", matchKind: "contains", field: "raw_label", markAsTransfer: true, priority: 50 },
    ])
    await commitImport(db, { bytes: cardCsv("Comptabilisée"), fileName: "card.csv" })
    await commitImport(db, { bytes: BANK_CSV, fileName: "bank.csv" })
    const stored = await db.select().from(transactions)
    const card = stored.find((transaction) => transaction.providerCategory === "Alimentation")
    expect(card?.categoryId).toBe(food?.id)
    expect(stored.filter((transaction) => transaction.isTransfer)).toHaveLength(2)
  })
})
