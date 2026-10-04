import { describe, expect, it } from "bun:test"
import type { CsvProfile } from "./csv-profile"
import { csvProfileSchema } from "./csv-profile"
import { detectCsvProfile, findCsvColumn, listCsvColumns, parseCsv } from "./csv-parser"
import { DEFAULT_CSV_PROFILES, RAIFFEISEN_CSV_PROFILE, SWISSCARD_CSV_PROFILE } from "./default-csv-profiles"
import { encodeLatin1, encodeUtf8 } from "./test-fixtures/encoding"
import { RAIFFEISEN_CSV } from "./test-fixtures/raiffeisen"
import { SWISSCARD_CSV } from "./test-fixtures/swisscard"

const raiffeisenBytes = encodeLatin1(RAIFFEISEN_CSV)
const swisscardBytes = encodeUtf8(SWISSCARD_CSV)

describe("parseCsv with the Raiffeisen profile", () => {
  const result = parseCsv(raiffeisenBytes, RAIFFEISEN_CSV_PROFILE)

  it("decodes ISO-8859-1 accents", () => {
    expect(result.transactions[0]?.rawLabel).toBe("Crédit Société Fictive SA")
  })

  it("maps every column of a valid line", () => {
    expect(result.transactions[1]).toEqual({
      accountIdentifier: "CH9300762011623852957",
      bookingDate: "2026-03-03",
      valueDate: "2026-03-02",
      rawLabel: "Achat Boulangerie du Lac, Morges",
      merchant: null,
      amount: -12.4,
      currency: "CHF",
      status: "booked",
      balanceAfter: 3088.1,
      sourceRef: null,
      providerCategory: null,
    })
  })

  it("removes thousands separators", () => {
    expect(result.transactions.at(-1)?.amount).toBe(-1250)
  })

  it("rejects malformed lines without stopping the import", () => {
    expect(result.transactions).toHaveLength(5)
    expect(result.errors).toEqual([
      { line: 6, message: "Date invalide : « pas une date »" },
      { line: 7, message: "3 colonnes au lieu de 6" },
    ])
  })
})

describe("parseCsv with the Swisscard profile", () => {
  const result = parseCsv(swisscardBytes, SWISSCARD_CSV_PROFILE)

  it("maps a pending debit", () => {
    expect(result.transactions[0]).toMatchObject({
      accountIdentifier: "5555 12** **** 3456",
      bookingDate: "2026-03-25",
      rawLabel: "EPICERIE FICTIVE 12, LAUSANNE",
      merchant: "Epicerie Fictive",
      amount: -11.95,
      status: "pending",
      providerCategory: "Comestibles",
    })
  })

  it("reads quoted labels with doubled quotes and thousands separators", () => {
    expect(result.transactions[1]).toMatchObject({ rawLabel: 'MAGASIN "LE COIN", NYON', amount: -1234.5, status: "booked" })
  })

  it("keeps credits positive", () => {
    expect(result.transactions[2]?.amount).toBe(40)
  })

  it("keeps each card as its own account", () => {
    const cards = new Set(result.transactions.map((transaction) => transaction.accountIdentifier))
    expect(cards).toEqual(new Set(["5555 12** **** 3456", "4444 98**** *7777"]))
  })

  it("rejects an invalid amount", () => {
    expect(result.errors).toEqual([{ line: 6, message: "Montant invalide : « abc »" }])
  })
})

describe("parseCsv with a custom profile", () => {
  const profile: CsvProfile = {
    id: "custom",
    name: "Banque décimale virgule",
    accountKind: "bank",
    encoding: "utf-8",
    delimiter: "\t",
    hasHeader: false,
    dateFormat: "dd/MM/yyyy",
    decimalSeparator: ",",
    defaultCurrency: "EUR",
    columns: { date: "1", label: "2" },
    amount: { mode: "signed", column: "3" },
    detect: { requiredHeaders: [] },
  }

  it("uses column positions, decimal commas and the default currency", () => {
    const bytes = encodeUtf8("01/02/2026\tLoyer\t-1 200,50\n02/02/2026\tSalaire\t3 000,00\n")
    const { transactions, errors } = parseCsv(bytes, profile)
    expect(errors).toEqual([])
    expect(transactions.map((transaction) => [transaction.bookingDate, transaction.amount, transaction.currency])).toEqual([
      ["2026-02-01", -1200.5, "EUR"],
      ["2026-02-02", 3000, "EUR"],
    ])
    expect(transactions[0]?.accountIdentifier).toBeNull()
  })

  it("reports a missing column", () => {
    const withHeader: CsvProfile = { ...profile, hasHeader: true, columns: { date: "Date", label: "Texte" } }
    const result = parseCsv(encodeUtf8("Date\tTexte\n01/02/2026\tLoyer\n"), withHeader)
    expect(result.errors).toEqual([{ line: 1, message: "Colonne introuvable : « 3 »" }])
  })
})

describe("listCsvColumns", () => {
  it("lists headers with a sample from the first data line", () => {
    const bytes = encodeUtf8("Date;Texte;Montant\n01.02.2026;Loyer;-1200.50\n")
    expect(listCsvColumns(bytes, { encoding: "utf-8", delimiter: ";", hasHeader: true })).toEqual([
      { name: "Date", sample: "01.02.2026" },
      { name: "Texte", sample: "Loyer" },
      { name: "Montant", sample: "-1200.50" },
    ])
  })

  it("skips blank and repeated headers", () => {
    const bytes = encodeUtf8("Date;;date; Texte \n01.02.2026;x;y;\n")
    expect(listCsvColumns(bytes, { encoding: "utf-8", delimiter: ";", hasHeader: true })).toEqual([
      { name: "Date", sample: "01.02.2026" },
      { name: "Texte", sample: null },
    ])
  })

  it("lists positions when the file has no header", () => {
    const bytes = encodeUtf8("01/02/2026\tLoyer\n")
    expect(listCsvColumns(bytes, { encoding: "utf-8", delimiter: "\t", hasHeader: false })).toEqual([
      { name: "1", sample: "01/02/2026" },
      { name: "2", sample: "Loyer" },
    ])
  })

  it("decodes headers with the given encoding", () => {
    const columns = listCsvColumns(raiffeisenBytes, RAIFFEISEN_CSV_PROFILE)
    expect(findCsvColumn(columns, RAIFFEISEN_CSV_PROFILE.columns.label.toUpperCase())?.name).toBe(
      RAIFFEISEN_CSV_PROFILE.columns.label,
    )
  })

  it("returns nothing for an empty file", () => {
    expect(listCsvColumns(encodeUtf8(""), { encoding: "utf-8", delimiter: ";", hasHeader: true })).toEqual([])
  })
})

describe("detectCsvProfile", () => {
  it("recognises a Raiffeisen export", () => {
    expect(detectCsvProfile(raiffeisenBytes, DEFAULT_CSV_PROFILES)?.id).toBe(RAIFFEISEN_CSV_PROFILE.id)
  })

  it("recognises a Swisscard export", () => {
    expect(detectCsvProfile(swisscardBytes, DEFAULT_CSV_PROFILES)?.id).toBe(SWISSCARD_CSV_PROFILE.id)
  })

  it("returns null for an unknown file", () => {
    expect(detectCsvProfile(encodeUtf8("foo;bar\n1;2\n"), DEFAULT_CSV_PROFILES)).toBeNull()
  })
})

describe("DEFAULT_CSV_PROFILES", () => {
  it.each(DEFAULT_CSV_PROFILES)("$name satisfies the profile schema", (profile) => {
    expect(csvProfileSchema.safeParse(profile).success).toBe(true)
  })
})
