import type { PreparedReceiptImage } from "@/lib/receipts/prepare-image"
import type { ReceiptDetailsValues } from "./receipt-form"

export type DetailsDraft = { image: PreparedReceiptImage; values: ReceiptDetailsValues }

export type DetailsStart = { values: ReceiptDetailsValues; autoOcr: boolean }

export function detailsStart(
  draft: DetailsDraft | null,
  image: PreparedReceiptImage,
  fresh: ReceiptDetailsValues,
): DetailsStart {
  if (draft === null) return { values: fresh, autoOcr: true }
  if (draft.image.sha256 === image.sha256) return { values: draft.values, autoOcr: false }
  return { values: { ...fresh, accountId: draft.values.accountId, note: draft.values.note }, autoOcr: true }
}
