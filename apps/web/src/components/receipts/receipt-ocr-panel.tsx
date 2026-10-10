import { ScanText, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import type { ReceiptOcrState } from "./use-receipt-ocr"

type ReceiptOcrPanelProps = ReceiptOcrState & {
  prefilled: boolean
  disabled: boolean
  onStart: () => void
  onCancel: () => void
}

export function ReceiptOcrPanel({ running, progress, prefilled, disabled, onStart, onCancel }: ReceiptOcrPanelProps) {
  const { t } = useTranslation()
  if (running) {
    const percent = Math.round(progress * 100)
    return (
      <div className="space-y-2 rounded-md border p-3" role="status" aria-live="polite">
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="tabular-nums">{t("receipts.ocr.reading", { percent })}</span>
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            <X />
            {t("receipts.ocr.cancel")}
          </Button>
        </div>
        <Progress value={percent} aria-label={t("receipts.ocr.read")} />
      </div>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={onStart}>
        <ScanText />
        {t("receipts.ocr.read")}
      </Button>
      {prefilled && <p className="text-sm text-muted-foreground">{t("receipts.ocr.prefilled")}</p>}
    </div>
  )
}
