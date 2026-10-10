import { ScanText, Sparkles, X } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import type { ReaderEngine } from "./use-receipt-reader"

type ReceiptOcrPanelProps = {
  engine: ReaderEngine | null
  progress: number
  prefilledBy: ReaderEngine | null
  aiAvailable: boolean
  disabled: boolean
  onStartAi: () => void
  onStartOcr: () => void
  onCancel: () => void
}

const PREFILLED_KEY: Record<ReaderEngine, string> = {
  ai: "receipts.ai.prefilled",
  ocr: "receipts.ocr.prefilled",
}

export function ReceiptOcrPanel({
  engine,
  progress,
  prefilledBy,
  aiAvailable,
  disabled,
  onStartAi,
  onStartOcr,
  onCancel,
}: ReceiptOcrPanelProps) {
  const { t } = useTranslation()
  if (engine === "ai") return <AiRunning onCancel={onCancel} />
  if (engine === "ocr") return <OcrRunning progress={progress} onCancel={onCancel} />
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {aiAvailable && (
        <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={onStartAi}>
          <Sparkles />
          {t("receipts.ai.analyze")}
        </Button>
      )}
      <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={onStartOcr}>
        <ScanText />
        {t("receipts.ocr.read")}
      </Button>
      {prefilledBy && <p className="text-sm text-muted-foreground">{t(PREFILLED_KEY[prefilledBy])}</p>}
    </div>
  )
}

function RunningPanel({ label, cancelLabel, onCancel, children }: {
  label: string
  cancelLabel: string
  onCancel: () => void
  children: ReactNode
}) {
  return (
    <div className="space-y-2 rounded-md border p-3" role="status" aria-live="polite">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="tabular-nums">{label}</span>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          <X />
          {cancelLabel}
        </Button>
      </div>
      {children}
    </div>
  )
}

function OcrRunning({ progress, onCancel }: { progress: number; onCancel: () => void }) {
  const { t } = useTranslation()
  const percent = Math.round(progress * 100)
  return (
    <RunningPanel label={t("receipts.ocr.reading", { percent })} cancelLabel={t("receipts.ocr.cancel")} onCancel={onCancel}>
      <Progress value={percent} aria-label={t("receipts.ocr.read")} />
    </RunningPanel>
  )
}

function AiRunning({ onCancel }: { onCancel: () => void }) {
  const { t } = useTranslation()
  return (
    <RunningPanel label={t("receipts.ai.running")} cancelLabel={t("receipts.ai.cancel")} onCancel={onCancel}>
      <div
        role="progressbar"
        aria-label={t("receipts.ai.analyze")}
        className="relative h-2 w-full overflow-hidden rounded-full bg-primary/20"
      >
        <div className="h-full w-full animate-pulse bg-primary" />
      </div>
    </RunningPanel>
  )
}
