import { useTranslation } from "react-i18next"
import type { Receipt } from "@/lib/api"
import { formatDate, formatDecimal } from "@/lib/format"
import { ReceiptStatusBadge } from "./receipt-status-badge"
import { ReceiptThumbnail } from "./receipt-thumbnail"

type ReceiptCardProps = {
  receipt: Receipt
  onOpen: (receipt: Receipt) => void
}

function receiptDateOf(receipt: Receipt): string {
  return receipt.receiptDate ?? receipt.capturedAt.slice(0, 10)
}

export function ReceiptCard({ receipt, onOpen }: ReceiptCardProps) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      onClick={() => onOpen(receipt)}
      className="flex flex-col overflow-hidden rounded-lg border bg-card text-left transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 active:bg-muted/50"
    >
      <ReceiptThumbnail receipt={receipt} className="aspect-[3/4] w-full" />
      <div className="space-y-1 p-3">
        <p className="truncate text-sm font-medium">{receipt.merchant ?? t("receipts.untitled")}</p>
        <p className="flex items-center justify-between gap-2 text-sm text-muted-foreground tabular-nums">
          <span>{formatDate(receiptDateOf(receipt))}</span>
          <span>{receipt.total === null ? "—" : formatDecimal(receipt.total)}</span>
        </p>
        <ReceiptStatusBadge status={receipt.status} />
      </div>
    </button>
  )
}
