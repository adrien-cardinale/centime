import type { ReceiptLineInput } from "@centime/core"
import type { PreparedReceiptImage } from "@/lib/receipts/prepare-image"

export type TransactionChanges = {
  categoryId?: string | null
  isTransfer?: boolean
  fixedItemId?: string | null
}

export type ImportUpload = {
  file: File
  profileId?: string | undefined
  accountId?: string | undefined
}

export type ReceiptFileUpload = {
  accountId: string
  file: File | PreparedReceiptImage
  transactionId?: string | null | undefined
  merchant?: string | null | undefined
  total?: number | null | undefined
  receiptDate?: string | null | undefined
  note?: string | null | undefined
  lines?: ReceiptLineInput[] | null | undefined
}

export type ReceiptCandidateOptions = {
  amountTolerance?: number | undefined
  dayTolerance?: number | undefined
}
