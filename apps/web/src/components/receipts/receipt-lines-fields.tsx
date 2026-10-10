import { Plus, Trash2 } from "lucide-react"
import { type Control, type UseFormSetValue, useFieldArray, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { CategorySelect } from "@/components/categories/category-select"
import { Button } from "@/components/ui/button"
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { formatDecimal, parseAmountInput } from "@/lib/format"
import { cn } from "@/lib/utils"
import { emptyLine, type ReceiptDetailsParsed, type ReceiptDetailsValues, type ReceiptLineValues } from "./receipt-form"
import { toCents } from "./receipt-lines"

const NO_CATEGORY = "none"

type LinesFieldsProps = {
  control: Control<ReceiptDetailsValues, unknown, ReceiptDetailsParsed>
  setValue: UseFormSetValue<ReceiptDetailsValues>
}

function sumOfLines(lines: readonly ReceiptLineValues[]): number {
  return lines.reduce((sum, line) => sum + toCents(parseAmountInput(line.amountText) ?? 0), 0)
}

export function ReceiptLinesFields({ control, setValue }: LinesFieldsProps) {
  const { t } = useTranslation()
  const { fields, append, remove } = useFieldArray({ control, name: "lines" })

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{t("receipts.details.lines")}</h3>
        <Button type="button" variant="outline" size="sm" onClick={() => append(emptyLine())}>
          <Plus />
          {t("receipts.details.addLine")}
        </Button>
      </div>
      {fields.length === 0 && <p className="text-sm text-muted-foreground">{t("receipts.details.noLines")}</p>}
      <ul className="space-y-3">
        {fields.map((entry, index) => (
          <LineFields key={entry.id} control={control} index={index} onRemove={() => remove(index)} />
        ))}
      </ul>
      {fields.length > 0 && <LinesBalance control={control} setValue={setValue} />}
    </section>
  )
}

type LineFieldsProps = {
  control: Control<ReceiptDetailsValues, unknown, ReceiptDetailsParsed>
  index: number
  onRemove: () => void
}

function LineFields({ control, index, onRemove }: LineFieldsProps) {
  const { t } = useTranslation()
  return (
    <li className="grid grid-cols-[1fr_7rem_auto] items-start gap-2 rounded-md border p-3">
      <FormField
        control={control}
        name={`lines.${index}.label`}
        render={({ field }) => (
          <FormItem>
            <FormLabel className="sr-only">{t("receipts.details.lineLabel")}</FormLabel>
            <FormControl>
              <Input placeholder={t("receipts.details.lineLabel")} autoComplete="off" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name={`lines.${index}.amountText`}
        render={({ field }) => (
          <FormItem>
            <FormLabel className="sr-only">{t("receipts.details.lineAmount")}</FormLabel>
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
      <Button type="button" variant="ghost" size="icon" aria-label={t("receipts.details.removeLine")} onClick={onRemove}>
        <Trash2 />
      </Button>
      <FormField
        control={control}
        name={`lines.${index}.categoryId`}
        render={({ field }) => (
          <FormItem className="col-span-3">
            <FormLabel className="sr-only">{t("receipts.details.lineCategory")}</FormLabel>
            <FormControl>
              <CategorySelect
                value={field.value ?? NO_CATEGORY}
                onChange={(categoryId) => field.onChange(categoryId === NO_CATEGORY ? null : categoryId)}
                extraOptions={[{ value: NO_CATEGORY, label: t("receipts.details.noCategory") }]}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </li>
  )
}

function LinesBalance({ control, setValue }: LinesFieldsProps) {
  const { t } = useTranslation()
  const [totalText, lines] = useWatch({ control, name: ["totalText", "lines"] })
  const linesCents = sumOfLines(lines)
  const total = parseAmountInput(totalText)
  const linesAmount = formatDecimal(linesCents / 100)

  if (total === null) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span className="tabular-nums">{t("receipts.details.linesSum", { amount: linesAmount })}</span>
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto px-0"
          onClick={() => setValue("totalText", (linesCents / 100).toFixed(2), { shouldValidate: true })}
        >
          {t("receipts.details.useSumAsTotal")}
        </Button>
      </div>
    )
  }

  const balanced = toCents(Math.abs(total)) === linesCents
  return (
    <p className={cn("text-sm tabular-nums", balanced ? "text-muted-foreground" : "font-medium text-destructive")}>
      {balanced
        ? t("receipts.details.linesMatch")
        : t("receipts.details.linesMismatch", { lines: linesAmount, total: formatDecimal(Math.abs(total)) })}
    </p>
  )
}
