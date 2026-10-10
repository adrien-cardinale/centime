import { describe, expect, it } from "bun:test"
import { splitRemainder, splitsBalance, transactionSplitSchema } from "./transaction-split-payload"

const TRANSACTION_ID = "8f0b6c1e-2d4a-4b7e-9a3c-5e6f7a8b9c0d"
const CATEGORY_ID = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d"

describe("splitsBalance", () => {
  it("accepts amounts whose sum equals the total", () => {
    expect(splitsBalance(-100, [{ amount: -60 }, { amount: -40 }])).toBe(true)
  })

  it("ignores floating point noise below the cent", () => {
    expect(splitsBalance(0.3, [{ amount: 0.1 }, { amount: 0.2 }])).toBe(true)
    expect(splitsBalance(-12.35, [{ amount: -10.1 }, { amount: -2.25 }])).toBe(true)
  })

  it("rejects a sum off by one cent", () => {
    expect(splitsBalance(-100, [{ amount: -60 }, { amount: -39.99 }])).toBe(false)
  })
})

describe("splitRemainder", () => {
  it("returns what is left to allocate", () => {
    expect(splitRemainder(-100, [{ amount: -60 }, { amount: -25.5 }])).toBe(-14.5)
    expect(splitRemainder(50, [])).toBe(50)
  })
})

describe("transactionSplitSchema", () => {
  const line = { categoryId: CATEGORY_ID, amount: -10 }

  it("normalises an empty note to null", () => {
    const parsed = transactionSplitSchema.parse({
      transactionId: TRANSACTION_ID,
      splits: [{ ...line, note: "  " }, { ...line, categoryId: null }],
    })
    expect(parsed.splits.map((split) => split.note)).toEqual([null, null])
  })

  it("requires at least two lines", () => {
    expect(transactionSplitSchema.safeParse({ transactionId: TRANSACTION_ID, splits: [line] }).success).toBe(false)
  })

  it("rejects more than twenty lines", () => {
    const splits = Array.from({ length: 21 }, () => line)
    expect(transactionSplitSchema.safeParse({ transactionId: TRANSACTION_ID, splits }).success).toBe(false)
  })

  it("rejects a zero amount", () => {
    const splits = [line, { ...line, amount: 0 }]
    expect(transactionSplitSchema.safeParse({ transactionId: TRANSACTION_ID, splits }).success).toBe(false)
  })
})
