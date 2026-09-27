import { describe, expect, it } from "vitest"
import { parseCsv } from "./csv-parser"
import { RAIFFEISEN_CSV_PROFILE } from "./default-csv-profiles"
import { assignOccurrences } from "./occurrences"
import type { ParsedTransaction } from "./parsed-transaction"
import { encodeLatin1 } from "./test-fixtures/encoding"
import { RAIFFEISEN_CSV } from "./test-fixtures/raiffeisen"

const base: ParsedTransaction = {
  accountIdentifier: "CH9300762011623852957",
  bookingDate: "2026-03-03",
  valueDate: null,
  rawLabel: "Paiement TWINT",
  merchant: null,
  amount: -20,
  currency: "CHF",
  status: "booked",
  balanceAfter: null,
  sourceRef: null,
  providerCategory: null,
}

describe("assignOccurrences", () => {
  it("numbers identical transactions in file order", () => {
    const { transactions } = parseCsv(encodeLatin1(RAIFFEISEN_CSV), RAIFFEISEN_CSV_PROFILE)
    expect(assignOccurrences(transactions).map((transaction) => transaction.occurrence)).toEqual([0, 0, 0, 1, 0])
  })

  it("treats label formatting differences as the same transaction", () => {
    const result = assignOccurrences([base, { ...base, rawLabel: "  paiement   twint " }])
    expect(result.map((transaction) => transaction.occurrence)).toEqual([0, 1])
  })

  it.each([
    ["account", { accountIdentifier: "CH5604835012345678009" }],
    ["date", { bookingDate: "2026-03-04" }],
    ["amount", { amount: -20.05 }],
    ["label", { rawLabel: "Paiement Coop" }],
  ])("keeps occurrence 0 when the %s differs", (_field, override) => {
    const result = assignOccurrences([base, { ...base, ...override }])
    expect(result.map((transaction) => transaction.occurrence)).toEqual([0, 0])
  })
})
