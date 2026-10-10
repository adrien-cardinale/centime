import { TriangleAlert } from "lucide-react"
import { type Control, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { ReceiptDetailsParsed, ReceiptDetailsValues } from "./receipt-form"
import { LOW_CONFIDENCE, type OcrField, type OcrFilledFields } from "./receipt-ocr-fill"

type OcrFieldWarningProps = {
  control: Control<ReceiptDetailsValues, unknown, ReceiptDetailsParsed>
  name: OcrField
  filled: OcrFilledFields
}

export function OcrFieldWarning({ control, name, filled }: OcrFieldWarningProps) {
  const { t } = useTranslation()
  const value = useWatch({ control, name })
  const entry = filled[name]
  if (!entry || entry.confidence >= LOW_CONFIDENCE || value !== entry.value) return null
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex text-amber-600 dark:text-amber-500" tabIndex={0} aria-label={t("receipts.ocr.uncertain")}>
            <TriangleAlert className="size-3.5" aria-hidden />
          </span>
        </TooltipTrigger>
        <TooltipContent>{t("receipts.ocr.uncertain")}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
