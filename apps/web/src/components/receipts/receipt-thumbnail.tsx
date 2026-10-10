import { FileText, ImageOff } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { Receipt } from "@/lib/api"
import { useReceiptImage } from "@/lib/receipts/use-receipt-image"
import { cn } from "@/lib/utils"

const PDF_MIME = "application/pdf"

type ReceiptThumbnailProps = {
  receipt: Pick<Receipt, "id" | "mime">
  className?: string
}

export function ReceiptThumbnail({ receipt, className }: ReceiptThumbnailProps) {
  const { t } = useTranslation()
  const isPdf = receipt.mime === PDF_MIME
  const url = useReceiptImage(isPdf ? null : receipt.id, receipt.mime)
  const frame = cn("flex items-center justify-center overflow-hidden bg-muted text-muted-foreground", className)
  if (isPdf) {
    return (
      <div className={frame}>
        <FileText className="size-8" aria-label={t("receipts.image.pdf")} />
      </div>
    )
  }
  if (url === null) {
    return (
      <div className={frame}>
        <ImageOff className="size-6" aria-hidden />
      </div>
    )
  }
  return (
    <div className={frame}>
      <img src={url} alt={t("receipts.image.alt")} className="size-full object-cover" loading="lazy" />
    </div>
  )
}
