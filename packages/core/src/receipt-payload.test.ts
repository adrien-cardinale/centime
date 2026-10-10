import { describe, expect, it } from "bun:test"
import { receiptCreateSchema, receiptUpdateSchema } from "./receipt-payload"

const ACCOUNT_ID = "8f0b6c1e-2d4a-4b7e-9a3c-5e6f7a8b9c0d"
const SHA256 = "a".repeat(64)

const minimalReceipt = { accountId: ACCOUNT_ID, mime: "image/jpeg", size: 2048, sha256: SHA256 }

describe("receiptCreateSchema", () => {
  it("fills optional fields with null and stamps the capture time", () => {
    const parsed = receiptCreateSchema.parse(minimalReceipt)

    expect(parsed).toMatchObject({ transactionId: null, merchant: null, total: null, receiptDate: null, lines: null })
    expect(Number.isNaN(Date.parse(parsed.capturedAt))).toBe(false)
  })

  it("normalises a blank merchant and defaults a line category to null", () => {
    const parsed = receiptCreateSchema.parse({
      ...minimalReceipt,
      merchant: "  ",
      lines: [{ label: " Pain ", amount: 3.2 }],
    })

    expect(parsed.merchant).toBeNull()
    expect(parsed.lines).toEqual([{ label: "Pain", amount: 3.2, categoryId: null }])
  })

  it("rejects an unsupported mime type", () => {
    expect(receiptCreateSchema.safeParse({ ...minimalReceipt, mime: "text/plain" }).success).toBe(false)
  })

  it("rejects a malformed sha256", () => {
    expect(receiptCreateSchema.safeParse({ ...minimalReceipt, sha256: "abc" }).success).toBe(false)
  })

  it("rejects an invalid receipt date", () => {
    expect(receiptCreateSchema.safeParse({ ...minimalReceipt, receiptDate: "2026-02-30" }).success).toBe(false)
  })
})

describe("receiptUpdateSchema", () => {
  it("keeps absent fields undefined and explicit nulls null", () => {
    const parsed = receiptUpdateSchema.parse({ total: null })

    expect(parsed.total).toBeNull()
    expect(parsed.merchant).toBeUndefined()
  })

  it("rejects an empty patch", () => {
    expect(receiptUpdateSchema.safeParse({}).success).toBe(false)
  })

  it("rejects an unknown status", () => {
    expect(receiptUpdateSchema.safeParse({ status: "archived" }).success).toBe(false)
  })
})
