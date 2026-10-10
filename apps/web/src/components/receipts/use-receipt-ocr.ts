import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import type { PreparedReceiptImage } from "@/lib/receipts/prepare-image"
import { type RecognizedReceipt, recognizeReceipt } from "@/lib/receipts/ocr"

export type ReceiptOcrState = { running: boolean; progress: number }

const IDLE: ReceiptOcrState = { running: false, progress: 0 }

export function useReceiptOcr(image: PreparedReceiptImage | null, onRecognized: (result: RecognizedReceipt) => void) {
  const { t } = useTranslation()
  const [state, setState] = useState<ReceiptOcrState>(IDLE)
  const controllerRef = useRef<AbortController | null>(null)
  const onRecognizedRef = useRef(onRecognized)
  onRecognizedRef.current = onRecognized

  const cancel = useCallback(() => {
    controllerRef.current?.abort()
    controllerRef.current = null
    setState(IDLE)
  }, [])

  const start = useCallback(async () => {
    if (!image) return
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setState({ running: true, progress: 0 })
    try {
      const result = await recognizeReceipt(image.bytes, image.mime, {
        signal: controller.signal,
        onProgress: (progress) => {
          if (!controller.signal.aborted) setState({ running: true, progress })
        },
      })
      if (!controller.signal.aborted) onRecognizedRef.current(result)
    } catch {
      if (!controller.signal.aborted) toast.error(t("receipts.ocr.failed"))
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null
        setState(IDLE)
      }
    }
  }, [image, t])

  useEffect(() => () => controllerRef.current?.abort(), [])

  return { ...state, start, cancel }
}
