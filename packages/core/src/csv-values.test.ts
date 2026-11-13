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

  it("keeps signs, the minus sign character and bare decimals working", () => {
    expect(parseAmountValue("+12.50", ".")).toBe(12.5)
    expect(parseAmountValue("−1'234.50", ".")).toBe(-1234.5)
    expect(parseAmountValue("- 42,10", ",")).toBe(-42.1)
    expect(parseAmountValue(".5", ".")).toBe(0.5)
    expect(parseAmountValue("12.", ".")).toBe(12)
  })

  it("parses non-breaking spaces as thousands separators", () => {
    expect(parseAmountValue("1\u00a0234\u00a0567,89", ",")).toBe(1234567.89)
    expect(parseAmountValue("1\u202f234.5", ".")).toBe(1234.5)
  })

  it("rejects a decimal separator that does not match the profile", () => {
    expect(() => parseAmountValue("12,50", ".")).toThrow(CsvValueError)
    expect(() => parseAmountValue("12.50", ",")).toThrow(CsvValueError)
    expect(() => parseAmountValue("1,2345", ".")).toThrow(CsvValueError)
  })

  it("rejects thousands separators that do not split groups of three digits", () => {
    expect(() => parseAmountValue("1,23,456.00", ".")).toThrow(CsvValueError)
    expect(() => parseAmountValue("1234,567.00", ".")).toThrow(CsvValueError)
    expect(() => parseAmountValue("1'234 567.00", ".")).toThrow(CsvValueError)
    expect(() => parseAmountValue("12'50", ".")).toThrow(CsvValueError)
  })

  it("rejects several decimal separators", () => {
    expect(() => parseAmountValue("1.234.567", ".")).toThrow(CsvValueError)
    expect(() => parseAmountValue("1,5,0", ",")).toThrow(CsvValueError)
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
