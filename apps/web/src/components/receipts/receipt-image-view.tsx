import { ExternalLink, FileText, ImageOff } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import type { Receipt } from "@/lib/api"
import { useReceiptImage } from "@/lib/receipts/use-receipt-image"
import { cn } from "@/lib/utils"

const PDF_MIME = "application/pdf"

export function ReceiptImageView({ receipt }: { receipt: Pick<Receipt, "id" | "mime"> }) {
  const { t } = useTranslation()
  const [fitted, setFitted] = useState(true)
  const url = useReceiptImage(receipt.id, receipt.mime)

  if (url === null) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-md bg-muted text-sm text-muted-foreground">
        <ImageOff className="size-6" aria-hidden />
        {t("receipts.image.missing")}
      </div>
    )
  }
  if (receipt.mime === PDF_MIME) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-md bg-muted">
        <FileText className="size-8 text-muted-foreground" aria-hidden />
        <Button variant="outline" asChild>
          <a href={url} target="_blank" rel="noreferrer">
            <ExternalLink />
            {t("receipts.image.openPdf")}
          </a>
        </Button>
      </div>
    )
  }
  return (
    <button
      type="button"
      onClick={() => setFitted((current) => !current)}
      aria-label={fitted ? t("receipts.image.zoomIn") : t("receipts.image.zoomOut")}
      className={cn("block w-full rounded-md bg-muted", fitted ? "overflow-hidden" : "max-h-[70vh] overflow-auto")}
    >
      <img
        src={url}
        alt={t("receipts.image.alt")}
        className={cn("mx-auto", fitted ? "max-h-[60vh] w-full object-contain" : "w-[200%] max-w-none")}
      />
    </button>
  )
}
