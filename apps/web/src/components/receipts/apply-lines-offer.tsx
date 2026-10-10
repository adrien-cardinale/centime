import { Split } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { useApplyReceiptLines } from "@/hooks/use-receipt-updates"
import type { Receipt } from "@/lib/api"

type ApplyLinesOfferProps = {
  receipt: Receipt
  onDone: () => void
}

export function ApplyLinesOffer({ receipt, onDone }: ApplyLinesOfferProps) {
  const { t } = useTranslation()
  const apply = useApplyReceiptLines(onDone)
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("receipts.split.description")}</p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onDone} disabled={apply.isPending}>
          {t("receipts.split.skip")}
        </Button>
        <Button type="button" onClick={() => apply.mutate(receipt.id)} disabled={apply.isPending}>
          <Split />
          {apply.isPending ? t("receipts.split.applying") : t("receipts.split.apply")}
        </Button>
      </div>
    </div>
  )
}
