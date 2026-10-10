import { describe, expect, it } from "bun:test"
import { buildReceiptAiInstruction, type ReceiptAiOutput, receiptAiOutputSchema, toAiExtractionResult } from "./receipt-ai"

const categories = [
  { id: "cat-food", name: "Alimentation" },
  { id: "cat-drinks", name: "Boissons" },
  { id: "cat-cafe", name: "Café" },
]

function output(changes: Partial<ReceiptAiOutput> = {}): ReceiptAiOutput {
  return {
    merchant: "Coop",
    total: 13.35,
    receiptDate: "2026-03-12",
    currency: "CHF",
    lines: [
      { label: "Lait entier 1l", amount: 1.85, categoryName: "Alimentation" },
      { label: "Coca-Cola 0.5l", amount: 2.2, categoryName: "boissons" },
    ],
    confidence: { merchant: 0.9, total: 0.95, receiptDate: 0.8 },
    ...changes,
  }
}

describe("receiptAiOutputSchema", () => {
  it("accepts a complete output", () => {
    expect(receiptAiOutputSchema.safeParse(output()).success).toBe(true)
  })

  it("accepts null fields", () => {
    const parsed = receiptAiOutputSchema.safeParse(
      output({ merchant: null, total: null, receiptDate: null, currency: null, lines: [] }),
    )
    expect(parsed.success).toBe(true)
  })

  it("rejects a line without amount", () => {
    const parsed = receiptAiOutputSchema.safeParse({ ...output(), lines: [{ label: "Pain", categoryName: null }] })
    expect(parsed.success).toBe(false)
  })

  it("rejects a missing confidence", () => {
    const { confidence: _, ...withoutConfidence } = output()
    expect(receiptAiOutputSchema.safeParse(withoutConfidence).success).toBe(false)
  })
})

describe("toAiExtractionResult", () => {
  it("maps category names to ids without case or accent", () => {
    const result = toAiExtractionResult(
      output({
        lines: [
          { label: "Lait", amount: 1.85, categoryName: "ALIMENTATION" },
          { label: "Espresso", amount: 4.5, categoryName: "cafe" },
          { label: "Journal", amount: 3, categoryName: "Presse" },
          { label: "Pain", amount: 2.9, categoryName: null },
        ],
      }),
      categories,
    )
    expect(result.lines.map((line) => line.categoryId)).toEqual(["cat-food", "cat-cafe", null, null])
  })

  it("keeps negative amounts and rounds to cents", () => {
    const result = toAiExtractionResult(
      output({ total: 7.604, lines: [{ label: "Rabais", amount: -0.801, categoryName: null }] }),
      categories,
    )
    expect(result.total).toBe(7.6)
    expect(result.lines).toEqual([{ label: "Rabais", amount: -0.8, categoryId: null }])
  })

  it("drops lines with an empty label", () => {
    const result = toAiExtractionResult(output({ lines: [{ label: "  ", amount: 1, categoryName: null }] }), categories)
    expect(result.lines).toEqual([])
  })

  it("clamps confidences to the 0..1 range", () => {
    const result = toAiExtractionResult(output({ confidence: { merchant: 1.4, total: -0.2, receiptDate: 0.5 } }), [])
    expect(result.confidence).toEqual({ merchant: 1, total: 0, receiptDate: 0.5 })
  })

  it("sets the confidence to 0 for a missing field", () => {
    const result = toAiExtractionResult(output({ merchant: " ", total: null }), categories)
    expect(result.merchant).toBeNull()
    expect(result.total).toBeNull()
    expect(result.confidence.merchant).toBe(0)
    expect(result.confidence.total).toBe(0)
  })

  it("rejects dates that are not real ISO dates", () => {
    expect(toAiExtractionResult(output({ receiptDate: "12.03.2026" }), []).receiptDate).toBeNull()
    expect(toAiExtractionResult(output({ receiptDate: "2026-02-30" }), []).receiptDate).toBeNull()
    expect(toAiExtractionResult(output({ receiptDate: "2024-02-29" }), []).receiptDate).toBe("2024-02-29")
  })

  it("normalizes the currency code", () => {
    expect(toAiExtractionResult(output({ currency: " chf " }), []).currency).toBe("CHF")
    expect(toAiExtractionResult(output({ currency: "Fr." }), []).currency).toBeNull()
  })
})

describe("buildReceiptAiInstruction", () => {
  it("lists every category name and today's date", () => {
    const instruction = buildReceiptAiInstruction(categories, "2026-10-10")
    expect(instruction).toContain("2026-10-10")
    for (const category of categories) expect(instruction).toContain(`- ${category.name}`)
  })

  it("asks for null categories when the list is empty", () => {
    expect(buildReceiptAiInstruction([], "2026-10-10")).toContain("use null for every line")
  })
})
