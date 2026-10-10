import { describe, expect, test } from "bun:test"
import type { ReceiptOcrResult } from "@centime/core"
import { filledFields, isFormEmptyForOcr, ocrFormPatch } from "./receipt-ocr-fill"

const result: ReceiptOcrResult = {
  merchant: "Migros",
  total: 12.5,
  receiptDate: "2026-10-01",
  lines: [{ label: "Pain", amount: 2.5 }, { label: "Lait", amount: 10 }],
  confidence: { merchant: 0.9, total: 0.4, receiptDate: 0.8 },
}

const empty = { merchant: "", totalText: "", receiptDate: "", lines: [] }

describe("pré-remplissage du ticket", () => {
  test("remplit tous les champs vides", () => {
    expect(ocrFormPatch(empty, result, false)).toEqual({
      merchant: "Migros",
      totalText: "12.50",
      receiptDate: "2026-10-01",
      lines: [
        { label: "Pain", amountText: "2.50", categoryId: null },
        { label: "Lait", amountText: "10.00", categoryId: null },
      ],
    })
  })

  test("garde les champs déjà remplis", () => {
    const current = { merchant: "Coop", totalText: "3.00", receiptDate: "2026-10-05", lines: [] }
    expect(ocrFormPatch(current, result, false)).toEqual({ lines: expect.any(Array) })
  })

  test("remplace la date par défaut si elle n'a pas été modifiée", () => {
    const current = { ...empty, receiptDate: "2026-10-10" }
    expect(ocrFormPatch(current, result, true).receiptDate).toBe("2026-10-01")
  })

  test("garde la confiance des champs remplis", () => {
    const patch = ocrFormPatch(empty, result, false)
    expect(filledFields(patch, result).totalText).toEqual({ value: "12.50", confidence: 0.4 })
  })

  test("détecte un formulaire vide", () => {
    expect(isFormEmptyForOcr({ ...empty, receiptDate: "2026-10-10" })).toBe(true)
    expect(isFormEmptyForOcr({ ...empty, merchant: "Coop" })).toBe(false)
  })

  test("garde la catégorie proposée pour chaque ligne", () => {
    const withCategories = { ...result, lines: [{ label: "Pain", amount: 2.5, categoryId: "cat-food" }] }
    expect(ocrFormPatch(empty, withCategories, false).lines).toEqual([
      { label: "Pain", amountText: "2.50", categoryId: "cat-food" },
    ])
  })
})
