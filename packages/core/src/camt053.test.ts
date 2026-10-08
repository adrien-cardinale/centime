import { describe, expect, it } from "bun:test"
import { parseCamt053 } from "./camt053"
import { detectImportFormat } from "./import-format"
import { BANK_CSV } from "./test-fixtures/bank"
import { CAMT_053, CAMT_IBAN, camtDocument, statement } from "./test-fixtures/camt053"
import { encodeLatin1, encodeUtf8 } from "./test-fixtures/encoding"

describe("parseCamt053", () => {
  const result = parseCamt053(encodeUtf8(CAMT_053))

  it("reads a credit entry", () => {
    expect(result.transactions[0]).toEqual({
      accountIdentifier: CAMT_IBAN,
      bookingDate: "2026-03-02",
      valueDate: "2026-03-02",
      rawLabel: "Crédit Société Fictive SA",
      merchant: null,
      amount: 2500.5,
      currency: "CHF",
      status: "booked",
      balanceAfter: null,
      sourceRef: "REF001",
      providerCategory: null,
    })
  })

  it("makes debit entries negative", () => {
    expect(result.transactions[1]).toMatchObject({ amount: -12.4, valueDate: "2026-03-02", sourceRef: "REF002" })
  })

  it("maps pending entries", () => {
    expect(result.transactions[2]?.status).toBe("pending")
  })

  it("inverts the sign of reversal entries", () => {
    expect(result.transactions[3]).toMatchObject({ amount: 15, rawLabel: "Annulation achat Kiosque & Co" })
  })

  it("tolerates entry details", () => {
    expect(result.transactions[4]).toMatchObject({ amount: -99.9, rawLabel: "Paiement facture Assurance Fictive" })
  })

  it("rejects an entry without date", () => {
    expect(result.transactions).toHaveLength(5)
    expect(result.errors).toEqual([{ line: 6, message: "Écriture 6 : Date de comptabilisation absente" }])
  })

  it("handles several statements with a single entry each", () => {
    const document = camtDocument([
      statement("CH5604835012345678009", [
        { amount: "10", indicator: "DBIT", bookingDate: "2026-04-01", valueDate: "2026-04-01", reference: "A1", label: "Premier" },
      ]),
      statement("CH 93 0076 2011 6238 5295 7", [
        { amount: "5", indicator: "CRDT", bookingDate: "2026-04-02", valueDate: "2026-04-02", reference: "B1", label: "Second" },
      ]),
    ])
    const { transactions } = parseCamt053(encodeUtf8(document))
    expect(transactions.map((transaction) => [transaction.accountIdentifier, transaction.amount])).toEqual([
      ["CH5604835012345678009", -10],
      [CAMT_IBAN, 5],
    ])
  })

  it("reports invalid XML", () => {
    const { transactions, errors } = parseCamt053(encodeUtf8("<?xml version=\"1.0\"?><Document><BkToCstmrStmt>"))
    expect(transactions).toEqual([])
    expect(errors).toHaveLength(1)
  })
})

describe("detectImportFormat", () => {
  it("detects camt.053 documents", () => {
    expect(detectImportFormat(encodeUtf8(CAMT_053))).toBe("camt053")
  })

  it("detects XML without prolog", () => {
    expect(detectImportFormat(encodeUtf8("<Document><BkToCstmrStmt></BkToCstmrStmt></Document>"))).toBe("camt053")
  })

  it("falls back to CSV", () => {
    expect(detectImportFormat(encodeLatin1(BANK_CSV))).toBe("csv")
  })
})
