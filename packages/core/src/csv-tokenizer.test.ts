import { describe, expect, it } from "bun:test"
import { tokenizeCsv } from "./csv-tokenizer"

describe("tokenizeCsv", () => {
  it("splits fields on the configured delimiter", () => {
    expect(tokenizeCsv("a;b;c\n1;2;3", ";").map((record) => record.fields)).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ])
  })

  it("keeps delimiters, doubled quotes and line breaks inside quoted fields", () => {
    const [record] = tokenizeCsv('"Dupont, Jean","Le ""Coin""","ligne 1\nligne 2"', ",")
    expect(record?.fields).toEqual(["Dupont, Jean", 'Le "Coin"', "ligne 1\nligne 2"])
  })

  it("handles CRLF and LF line endings and skips blank lines", () => {
    const records = tokenizeCsv("a,b\r\n1,2\r\n\r\n3,4\n", ",")
    expect(records.map((record) => record.fields)).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
    ])
    expect(records.map((record) => record.line)).toEqual([1, 2, 4])
  })

  it("ignores a UTF-8 byte order mark", () => {
    expect(tokenizeCsv("﻿Date,Montant\n", ",")[0]?.fields).toEqual(["Date", "Montant"])
  })

  it("reports the starting line of records spanning several lines", () => {
    const records = tokenizeCsv('a,b\n"x\ny",1\nz,2', ",")
    expect(records.map((record) => record.line)).toEqual([1, 2, 4])
  })

  it("keeps empty quoted fields", () => {
    expect(tokenizeCsv('"",""', ",")[0]?.fields).toEqual(["", ""])
  })
})
