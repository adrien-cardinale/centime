import { describe, expect, test } from "bun:test"
import type { PreparedReceiptImage } from "@/lib/receipts/prepare-image"
import { detailsStart } from "./receipt-draft"
import type { ReceiptDetailsValues } from "./receipt-form"

function image(sha256: string): PreparedReceiptImage {
  return { bytes: new Uint8Array(), mime: "image/jpeg", width: 1, height: 1, sha256, source: null }
}

const fresh: ReceiptDetailsValues = {
  accountId: "a1",
  merchant: "",
  totalText: "",
  receiptDate: "2026-11-13",
  note: "",
  lines: [],
}

const typed: ReceiptDetailsValues = {
  accountId: "a2",
  merchant: "Migros",
  totalText: "12.50",
  receiptDate: "2026-11-10",
  note: "courses",
  lines: [{ label: "Pain", amountText: "3.20", categoryId: null }],
}

describe("reprise des détails du ticket", () => {
  test("lance la lecture au premier passage", () => {
    expect(detailsStart(null, image("x"), fresh)).toEqual({ values: fresh, autoOcr: true })
  })

  test("garde les détails sans relire la même image", () => {
    expect(detailsStart({ image: image("x"), values: typed }, image("x"), fresh)).toEqual({
      values: typed,
      autoOcr: false,
    })
  })

  test("relit une nouvelle image en gardant le compte et la note", () => {
    const start = detailsStart({ image: image("x"), values: typed }, image("y"), fresh)
    expect(start.autoOcr).toBe(true)
    expect(start.values).toEqual({ ...fresh, accountId: "a2", note: "courses" })
  })
})
