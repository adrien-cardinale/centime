import { describe, expect, it } from "bun:test"
import { computeTransactionFingerprint, fnv1a64, normalizeLabel } from "./fingerprint"

const baseInput = {
  accountId: "acc-1",
  bookingDate: "2026-09-26",
  amount: -42.5,
  label: "Migros Villefictive",
}

describe("fnv1a64", () => {
  it("matches the reference vectors", () => {
    expect(fnv1a64("")).toBe("cbf29ce484222325")
    expect(fnv1a64("a")).toBe("af63dc4c8601ec8c")
  })
})

describe("normalizeLabel", () => {
  it("removes case, accents and extra whitespace", () => {
    expect(normalizeLabel("  Café   DU  Marché ")).toBe("cafe du marche")
  })
})

describe("computeTransactionFingerprint", () => {
  it("is stable for identical input", () => {
    expect(computeTransactionFingerprint(baseInput)).toBe(computeTransactionFingerprint({ ...baseInput }))
  })

  it("returns a 16 character hex string", () => {
    expect(computeTransactionFingerprint(baseInput)).toMatch(/^[0-9a-f]{16}$/)
  })

  it("ignores label formatting differences", () => {
    const variant = { ...baseInput, label: "  MIGROS   villefictive " }
    expect(computeTransactionFingerprint(variant)).toBe(computeTransactionFingerprint(baseInput))
  })

  it("ignores floating point noise on the amount", () => {
    const variant = { ...baseInput, amount: -42.500000001 }
    expect(computeTransactionFingerprint(variant)).toBe(computeTransactionFingerprint(baseInput))
  })

  it.each([
    ["accountId", { accountId: "acc-2" }],
    ["bookingDate", { bookingDate: "2026-09-27" }],
    ["amount", { amount: 42.5 }],
    ["label", { label: "Coop Villefictive" }],
    ["occurrence", { occurrence: 1 }],
  ])("changes when %s changes", (_field, override) => {
    const variant = { ...baseInput, ...override }
    expect(computeTransactionFingerprint(variant)).not.toBe(computeTransactionFingerprint(baseInput))
  })

  it("rejects an invalid date", () => {
    expect(() => computeTransactionFingerprint({ ...baseInput, bookingDate: "26.09.2026" })).toThrow(RangeError)
  })

  it("rejects a non finite amount", () => {
    expect(() => computeTransactionFingerprint({ ...baseInput, amount: Number.NaN })).toThrow(RangeError)
  })
})
