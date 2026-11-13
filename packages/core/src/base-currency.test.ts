import { describe, expect, it } from "bun:test"
import {
  baseCurrencyOptions,
  countOtherCurrencyAccounts,
  FALLBACK_BASE_CURRENCY,
  majorityCurrency,
  normalizeCurrencyCode,
  resolveBaseCurrency,
} from "./base-currency"

describe("majorityCurrency", () => {
  it("returns the currency used by most accounts", () => {
    expect(majorityCurrency(["EUR", "CHF", "EUR"])).toBe("EUR")
  })

  it("breaks a tie alphabetically", () => {
    expect(majorityCurrency(["EUR", "CHF"])).toBe("CHF")
  })

  it("returns null without accounts", () => {
    expect(majorityCurrency([])).toBeNull()
  })
})

describe("normalizeCurrencyCode", () => {
  it("uppercases a three-letter code", () => {
    expect(normalizeCurrencyCode(" eur ")).toBe("EUR")
  })

  it("rejects anything else", () => {
    expect(normalizeCurrencyCode("EUROS")).toBeNull()
  })
})

describe("resolveBaseCurrency", () => {
  it("prefers the stored preference", () => {
    expect(resolveBaseCurrency("usd", ["CHF", "CHF"])).toBe("USD")
  })

  it("ignores an invalid stored value", () => {
    expect(resolveBaseCurrency("EUROS", ["EUR"])).toBe("EUR")
  })

  it("falls back to the majority of accounts, then to CHF", () => {
    expect(resolveBaseCurrency(undefined, ["EUR", "EUR", "CHF"])).toBe("EUR")
    expect(resolveBaseCurrency(undefined, [])).toBe(FALLBACK_BASE_CURRENCY)
  })
})

describe("baseCurrencyOptions", () => {
  it("lists each account currency once with the current value, sorted", () => {
    expect(baseCurrencyOptions(["EUR", "CHF", "EUR"], "USD")).toEqual(["CHF", "EUR", "USD"])
  })
})

describe("countOtherCurrencyAccounts", () => {
  it("counts the accounts held in another currency", () => {
    expect(countOtherCurrencyAccounts(["CHF", "EUR", "USD", "CHF"], "CHF")).toBe(2)
  })
})
