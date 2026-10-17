import { describe, expect, it } from "bun:test"
import { detectCsvDelimiter, detectCsvEncoding, detectCsvFormat } from "./csv-format-detection"
import { BANK_CSV } from "./test-fixtures/bank"
import { CARD_CSV } from "./test-fixtures/card"
import { BANK_TEST_PROFILE, CARD_TEST_PROFILE } from "./test-fixtures/csv-profiles"
import { encodeLatin1, encodeUtf8 } from "./test-fixtures/encoding"

describe("detectCsvEncoding", () => {
  it("keeps UTF-8 when the bytes decode strictly", () => {
    expect(detectCsvEncoding(encodeUtf8("Libellé;Montant\n"))).toBe("utf-8")
  })

  it("falls back to ISO-8859-1 on invalid UTF-8", () => {
    expect(detectCsvEncoding(encodeLatin1("Libellé;Montant\n"))).toBe("iso-8859-1")
  })

  it("accepts a sample cut inside a multibyte character", () => {
    const bytes = encodeUtf8("Date;Libellé")
    expect(detectCsvEncoding(bytes.subarray(0, bytes.length - 1))).toBe("utf-8")
  })
})

describe("detectCsvDelimiter", () => {
  it("picks the delimiter with a steady column count", () => {
    expect(detectCsvDelimiter("Date,Texte,Montant\n01.02.2026,Loyer,-1200.50\n")).toBe(",")
    expect(detectCsvDelimiter("Date\tTexte\tMontant\n01.02.2026\tLoyer\t-1200.50\n")).toBe("\t")
  })

  it("ignores decimal commas inside a semicolon file", () => {
    expect(detectCsvDelimiter("Date;Texte;Montant\n01.02.2026;Loyer;-1200,50\n02.02.2026;Café;-4,20\n")).toBe(";")
  })

  it("ignores delimiters inside quoted fields", () => {
    expect(detectCsvDelimiter('Date;Texte\n01.02.2026;"Loyer, février"\n')).toBe(";")
  })

  it("defaults to semicolon when nothing splits", () => {
    expect(detectCsvDelimiter("Date\n01.02.2026\n")).toBe(";")
  })
})

describe("detectCsvFormat", () => {
  it("matches the bank test profile", () => {
    expect(detectCsvFormat(encodeLatin1(BANK_CSV))).toEqual({
      encoding: BANK_TEST_PROFILE.encoding,
      delimiter: BANK_TEST_PROFILE.delimiter,
    })
  })

  it("matches the card test profile", () => {
    expect(detectCsvFormat(encodeUtf8(CARD_CSV))).toEqual({
      encoding: CARD_TEST_PROFILE.encoding,
      delimiter: CARD_TEST_PROFILE.delimiter,
    })
  })
})
