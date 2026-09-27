import { describe, expect, it } from "vitest"
import { encodeCsv, encodeCsvField } from "./csv-encoder"
import { tokenizeCsv } from "./csv-tokenizer"

describe("encodeCsvField", () => {
  it("keeps plain values untouched", () => {
    expect(encodeCsvField("Migros", ";")).toBe("Migros")
    expect(encodeCsvField(-12.5, ";")).toBe("-12.5")
    expect(encodeCsvField(null, ";")).toBe("")
  })

  it("quotes values containing the delimiter, quotes or line breaks", () => {
    expect(encodeCsvField("a;b", ";")).toBe('"a;b"')
    expect(encodeCsvField('dit "bonjour"', ";")).toBe('"dit ""bonjour"""')
    expect(encodeCsvField("ligne 1\nligne 2", ";")).toBe('"ligne 1\nligne 2"')
    expect(encodeCsvField(" espace", ";")).toBe('" espace"')
  })

  it("does not quote a comma when the delimiter is a semicolon", () => {
    expect(encodeCsvField("a,b", ";")).toBe("a,b")
  })
})

describe("encodeCsv", () => {
  it("ends every row with CRLF and round-trips through the tokenizer", () => {
    const rows = [
      ["Libellé", "Montant"],
      ['Café "Le Coin"; Lausanne', -4.2],
      ["Multi\r\nligne", null],
    ]
    const text = encodeCsv(rows, ";")
    expect(text.endsWith("\r\n")).toBe(true)
    expect(tokenizeCsv(text, ";").map((record) => record.fields)).toEqual([
      ["Libellé", "Montant"],
      ['Café "Le Coin"; Lausanne', "-4.2"],
      ["Multi\r\nligne", ""],
    ])
  })
})
