import { Receipt as ReceiptIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import type { Receipt } from "@/lib/api"

type ReceiptBadgeButtonProps = {
  receipt: Receipt | undefined
  onOpen: (receipt: Receipt) => void
}

export function ReceiptBadgeButton({ receipt, onOpen }: ReceiptBadgeButtonProps) {
  const { t } = useTranslation()
  if (!receipt) return null
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-10 shrink-0 text-muted-foreground md:size-8"
      aria-label={t("receipts.viewReceipt")}
      title={t("receipts.viewReceipt")}
      onClick={() => onOpen(receipt)}
    >
      <ReceiptIcon />
    </Button>
  )
}
