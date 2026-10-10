import { useCallback, useEffect, useRef, useState } from "react"
import {
  type AiExtractionCategory,
  type AiExtractionResult,
  extractReceiptWithAi,
} from "@/lib/receipts/ai-extract"
import type { AiExtractionSettings } from "@/lib/receipts/ai-settings"
import type { PreparedReceiptImage } from "@/lib/receipts/prepare-image"
import { type AiFailureKind, aiFailureKind } from "./ai-failure"

export type ReceiptAiState = { running: boolean; error: AiFailureKind | null }

const IDLE: ReceiptAiState = { running: false, error: null }

type ReceiptAiOptions = {
  image: PreparedReceiptImage | null
  categories: AiExtractionCategory[]
  settings: AiExtractionSettings
  onExtracted: (result: AiExtractionResult) => void
  onFailed: (kind: AiFailureKind) => void
}

function useLatest<T>(value: T) {
  const ref = useRef(value)
  ref.current = value
  return ref
}

export function useReceiptAi({ image, categories, settings, onExtracted, onFailed }: ReceiptAiOptions) {
  const [state, setState] = useState<ReceiptAiState>(IDLE)
  const controllerRef = useRef<AbortController | null>(null)
  const latest = useLatest({ categories, settings, onExtracted, onFailed })

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
    setState({ running: true, error: null })
    let failure: AiFailureKind | null = null
    try {
      const { categories, settings } = latest.current
      const result = await extractReceiptWithAi({
        bytes: image.bytes,
        mime: image.mime,
        categories,
        settings,
        signal: controller.signal,
      })
      if (!controller.signal.aborted) latest.current.onExtracted(result)
    } catch (error) {
      if (!controller.signal.aborted) failure = aiFailureKind(error)
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null
        setState({ running: false, error: failure })
      }
    }
    if (failure) latest.current.onFailed(failure)
  }, [image, latest])

  useEffect(() => () => controllerRef.current?.abort(), [])

  return { ...state, start, cancel }
}
