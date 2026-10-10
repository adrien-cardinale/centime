import { useCallback } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import type { AiExtractionCategory, AiExtractionResult } from "@/lib/receipts/ai-extract"
import type { AiExtractionSettings } from "@/lib/receipts/ai-settings"
import type { RecognizedReceipt } from "@/lib/receipts/ocr"
import type { PreparedReceiptImage } from "@/lib/receipts/prepare-image"
import { type AiFailureKind, aiFailureReasonKey } from "./ai-failure"
import { useReceiptAi } from "./use-receipt-ai"
import { useReceiptOcr } from "./use-receipt-ocr"

export type ReaderEngine = "ai" | "ocr"

type ReceiptReaderOptions = {
  image: PreparedReceiptImage | null
  aiEnabled: boolean
  categories: AiExtractionCategory[]
  settings: AiExtractionSettings
  onRecognized: (result: RecognizedReceipt) => void
  onExtracted: (result: AiExtractionResult) => void
}

export function useReceiptReader({
  image,
  aiEnabled,
  categories,
  settings,
  onRecognized,
  onExtracted,
}: ReceiptReaderOptions) {
  const { t } = useTranslation()
  const ocr = useReceiptOcr(image, onRecognized)
  const { start: startLocalOcr, cancel: cancelOcr } = ocr

  const fallBackToOcr = (kind: AiFailureKind) => {
    toast.warning(t("receipts.ai.fallback", { reason: t(aiFailureReasonKey(kind)) }))
    void startLocalOcr()
  }

  const ai = useReceiptAi({
    image: aiEnabled ? image : null,
    categories,
    settings,
    onExtracted,
    onFailed: fallBackToOcr,
  })
  const { start: startAiExtraction, cancel: cancelAi } = ai

  const startOcr = useCallback(() => {
    cancelAi()
    return startLocalOcr()
  }, [cancelAi, startLocalOcr])

  const startAi = useCallback(() => {
    cancelOcr()
    return startAiExtraction()
  }, [cancelOcr, startAiExtraction])

  const cancel = useCallback(() => {
    cancelAi()
    cancelOcr()
  }, [cancelAi, cancelOcr])

  const engine: ReaderEngine | null = ai.running ? "ai" : ocr.running ? "ocr" : null

  return {
    engine,
    progress: ocr.progress,
    start: aiEnabled ? startAi : startOcr,
    startAi,
    startOcr,
    cancel,
  }
}
