import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery } from "@tanstack/react-query"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { type UseFormReturn, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { AccountSelect } from "@/components/accounts/account-select"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { todayIso } from "@/lib/budgets"
import { categoriesQuery } from "@/lib/queries"
import { type AiExtractionCategory, isAiExtractionSupported } from "@/lib/receipts/ai-extract"
import { isAiExtractionReady, useAiExtractionSettings } from "@/lib/receipts/ai-settings"
import { isOcrSupported, type RecognizedReceipt } from "@/lib/receipts/ocr"
import type { PreparedReceiptImage } from "@/lib/receipts/prepare-image"
import { AiSettingsHint } from "./ai-settings-hint"
import { OcrFieldWarning } from "./ocr-field-warning"
import {
  type ReceiptDetails,
  type ReceiptDetailsParsed,
  type ReceiptDetailsValues,
  receiptDetailsSchema,
  toReceiptDetails,
} from "./receipt-form"
import { ReceiptLinesFields } from "./receipt-lines-fields"
import {
  filledFields,
  isEmptyPatch,
  isFormEmptyForOcr,
  type OcrFilledFields,
  type OcrPatch,
  ocrFormPatch,
  type PrefillResult,
} from "./receipt-ocr-fill"
import { ReceiptOcrPanel } from "./receipt-ocr-panel"
import { type ReaderEngine, useReceiptReader } from "./use-receipt-reader"

type DetailsForm = UseFormReturn<ReceiptDetailsValues, unknown, ReceiptDetailsParsed>

type ReceiptDetailsFormProps = {
  defaultValues: ReceiptDetailsValues
  showAccount: boolean
  submitLabel: string
  pendingLabel: string
  pending: boolean
  onSubmit: (details: ReceiptDetails) => void
  onBack?: () => void
  backLabel?: string
  ocrImage?: PreparedReceiptImage | null
  autoOcr?: boolean
  aiSettingsHint?: boolean
}

function applyPatch(form: DetailsForm, patch: OcrPatch) {
  const options = { shouldDirty: true, shouldValidate: true }
  if (patch.merchant !== undefined) form.setValue("merchant", patch.merchant, options)
  if (patch.totalText !== undefined) form.setValue("totalText", patch.totalText, options)
  if (patch.receiptDate !== undefined) form.setValue("receiptDate", patch.receiptDate, options)
  if (patch.lines !== undefined) form.setValue("lines", patch.lines, options)
}

function isDefaultDate(form: DetailsForm): boolean {
  return !form.getFieldState("receiptDate").isDirty && form.getValues("receiptDate") === todayIso()
}

const NO_CATEGORIES: AiExtractionCategory[] = []

function toAiCategories(categories: readonly AiExtractionCategory[]): AiExtractionCategory[] {
  return categories.map(({ id, name }) => ({ id, name }))
}

function useAiReadiness() {
  const { settings, isLoading } = useAiExtractionSettings()
  const enabled = !isLoading && isAiExtractionReady(settings)
  const categories = useQuery({ ...categoriesQuery, select: toAiCategories, enabled })
  const canAutoRun = !isLoading && (!enabled || categories.isSuccess)
  return { settings, enabled, isLoading, canAutoRun, categories: categories.data ?? NO_CATEGORIES }
}

function useOcrPrefill(form: DetailsForm, image: PreparedReceiptImage | null, autoOcr: boolean) {
  const { t } = useTranslation()
  const [filled, setFilled] = useState<OcrFilledFields | null>(null)
  const [prefilledBy, setPrefilledBy] = useState<ReaderEngine | null>(null)
  const readableImage = image && isOcrSupported(image.mime) ? image : null
  const ai = useAiReadiness()
  const aiEnabled = ai.enabled && readableImage !== null && isAiExtractionSupported(readableImage.mime)

  const applyPrefill = (result: PrefillResult, engine: ReaderEngine) => {
    const patch = ocrFormPatch(form.getValues(), result, isDefaultDate(form))
    if (isEmptyPatch(patch)) {
      toast.info(t("receipts.ocr.nothingFound"))
      return
    }
    applyPatch(form, patch)
    setFilled(filledFields(patch, result))
    setPrefilledBy(engine)
  }

  const applyRecognized = (result: RecognizedReceipt) => {
    if (result.rawText.trim() === "") {
      toast.error(t("receipts.ocr.noText"))
      return
    }
    applyPrefill(result, "ocr")
  }

  const reader = useReceiptReader({
    image: readableImage,
    aiEnabled,
    categories: ai.categories,
    settings: ai.settings,
    onRecognized: applyRecognized,
    onExtracted: (result) => applyPrefill(result, "ai"),
  })
  const autoStarted = useRef(false)
  const { start, cancel } = reader
  const { canAutoRun } = ai
  useEffect(() => {
    if (!autoOcr || !readableImage || !canAutoRun) return
    if (autoStarted.current || !isFormEmptyForOcr(form.getValues())) return
    autoStarted.current = true
    void start()
    return () => {
      autoStarted.current = false
      cancel()
    }
  }, [autoOcr, readableImage, canAutoRun, form, start, cancel])

  return {
    reader,
    filled,
    prefilledBy,
    available: readableImage !== null,
    aiEnabled,
    aiMissing: !ai.isLoading && !ai.enabled,
  }
}

export function ReceiptDetailsForm({
  defaultValues,
  showAccount,
  submitLabel,
  pendingLabel,
  pending,
  onSubmit,
  onBack,
  backLabel,
  ocrImage = null,
  autoOcr = false,
  aiSettingsHint = false,
}: ReceiptDetailsFormProps) {
  const { t } = useTranslation()
  const form = useForm<ReceiptDetailsValues, unknown, ReceiptDetailsParsed>({
    resolver: zodResolver(receiptDetailsSchema),
    defaultValues,
  })
  const prefill = useOcrPrefill(form, ocrImage, autoOcr)
  const filled = prefill.filled ?? {}

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((parsed) => onSubmit(toReceiptDetails(parsed)))} className="space-y-5">
        {prefill.available && (
          <div className="space-y-2">
            <ReceiptOcrPanel
              engine={prefill.reader.engine}
              progress={prefill.reader.progress}
              prefilledBy={prefill.prefilledBy}
              aiAvailable={prefill.aiEnabled}
              disabled={pending}
              onStartAi={() => void prefill.reader.startAi()}
              onStartOcr={() => void prefill.reader.startOcr()}
              onCancel={prefill.reader.cancel}
            />
            {aiSettingsHint && prefill.aiMissing && <AiSettingsHint />}
          </div>
        )}
        {showAccount && (
          <FormField
            control={form.control}
            name="accountId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("receipts.details.account")}</FormLabel>
                <FormControl>
                  <AccountSelect value={field.value || undefined} onChange={(accountId) => field.onChange(accountId ?? "")} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <FormField
          control={form.control}
          name="merchant"
          render={({ field }) => (
            <FormItem>
              <OcrLabel label={t("receipts.details.merchant")}>
                <OcrFieldWarning control={form.control} name="merchant" filled={filled} />
              </OcrLabel>
              <FormControl>
                <Input
                  placeholder={t("receipts.details.merchantPlaceholder")}
                  autoComplete="off"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="totalText"
            render={({ field }) => (
              <FormItem>
                <OcrLabel label={t("receipts.details.total")}>
                  <OcrFieldWarning control={form.control} name="totalText" filled={filled} />
                </OcrLabel>
                <FormControl>
                  <Input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder={t("receipts.details.amountPlaceholder")}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="receiptDate"
            render={({ field }) => (
              <FormItem>
                <OcrLabel label={t("receipts.details.date")}>
                  <OcrFieldWarning control={form.control} name="receiptDate" filled={filled} />
                </OcrLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <ReceiptLinesFields control={form.control} setValue={form.setValue} />
        <FormField
          control={form.control}
          name="note"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("receipts.details.note")}</FormLabel>
              <FormControl>
                <Textarea rows={2} {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {onBack && (
            <Button type="button" variant="outline" onClick={onBack} disabled={pending}>
              {backLabel ?? t("receipts.actions.back")}
            </Button>
          )}
          <Button type="submit" disabled={pending}>
            {pending ? pendingLabel : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  )
}

function OcrLabel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <FormLabel>{label}</FormLabel>
      {children}
    </div>
  )
}
