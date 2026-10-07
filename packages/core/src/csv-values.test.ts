import { describe, expect, it } from "bun:test"
import { CsvValueError, isCurrencyCode, parseAmountValue } from "./csv-values"

describe("parseAmountValue", () => {
  it("parses the European format with dot thousands and comma decimal", () => {
    expect(parseAmountValue("1.234,56", ",")).toBe(1234.56)
    expect(parseAmountValue("-1.234.567,89", ",")).toBe(-1234567.89)
  })

  it("parses the English format with comma thousands and dot decimal", () => {
    expect(parseAmountValue("1,234.56", ".")).toBe(1234.56)
    expect(parseAmountValue("-12,345", ".")).toBe(-12345)
  })

  it("keeps apostrophe and space thousands separators working", () => {
    expect(parseAmountValue("1'234.56", ".")).toBe(1234.56)
    expect(parseAmountValue("1 234,56", ",")).toBe(1234.56)
  })

  it("rejects a value that is not an amount", () => {
    expect(() => parseAmountValue("abc", ".")).toThrow(CsvValueError)
    expect(() => parseAmountValue("", ",")).toThrow(CsvValueError)
  })
})

describe("isCurrencyCode", () => {
  it("accepts three-letter codes and rejects anything else", () => {
    expect(isCurrencyCode("CHF")).toBe(true)
    expect(isCurrencyCode("eur")).toBe(true)
    expect(isCurrencyCode("EUROS")).toBe(false)
    expect(isCurrencyCode("Fr.")).toBe(false)
    expect(isCurrencyCode("")).toBe(false)
  })
})
