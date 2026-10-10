import { type FixedItemPayload, fixedItemPayloadSchema, PERIODICITIES, type Periodicity } from "@centime/core"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { type ReactNode, useState } from "react"
import { useTranslation } from "react-i18next"
import { type Control, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { CreatableCategorySelect } from "@/components/categories/creatable-category-select"
import { useRuleTester } from "@/components/rules/rule-matcher-inputs"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { api, type FixedItem } from "@/lib/api"
import { type Direction, directionOf, signedAmount } from "@/lib/fixed-items"
import { getMonthLabels, getQuarterMonthLabels, periodicityLabels } from "@/lib/labels"
import { invalidateFixedItemData } from "@/lib/queries"
import {
  amountFromText,
  defaultDueMonth,
  emptyRule,
  type FixedItemFormValues,
  formValuesFor,
  NO_CATEGORY,
} from "./fixed-item-form"
import { FixedItemRuleSection } from "./fixed-item-rule-section"

type FixedItemControl = Control<FixedItemFormValues, unknown, FixedItemPayload>

type FixedItemDialogProps = {
  item?: FixedItem
  trigger: ReactNode
}

const DIRECTIONS = ["expense", "income"] as const satisfies readonly Direction[]

function absoluteText(amount: number): string {
  return amount === 0 ? "" : String(Math.abs(amount))
}

function saveFixedItem(item: FixedItem | undefined, input: FixedItemPayload) {
  return item ? api.fixedItems.update(item.id, input) : api.fixedItems.create(input)
}

function isPeriodicity(value: string): value is Periodicity {
  return PERIODICITIES.some((periodicity) => periodicity === value)
}

function toOptionalInteger(value: string): number | null {
  return value === "" ? null : Number(value)
}

export function FixedItemDialog({ item, trigger }: FixedItemDialogProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [direction, setDirection] = useState<Direction>(directionOf(item?.expectedAmount ?? -1))
  const [amountText, setAmountText] = useState(absoluteText(item?.expectedAmount ?? 0))
  const queryClient = useQueryClient()
  const tester = useRuleTester()
  const form = useForm<FixedItemFormValues, unknown, FixedItemPayload>({
    resolver: zodResolver(fixedItemPayloadSchema),
    defaultValues: formValuesFor(item),
  })

  const save = useMutation({
    mutationFn: (input: FixedItemPayload) => saveFixedItem(item, input),
    onSuccess: async (saved) => {
      await invalidateFixedItemData(queryClient)
      toast.success(t("fixedItemsUi.dialog.saved", { name: saved.name }), {
        description: t("fixedItemsUi.dialog.linked", { count: saved.linkedCount }),
      })
      setOpen(false)
    },
    onError: (error) => toast.error(error.message),
  })

  function changeOpen(next: boolean) {
    if (next) {
      form.reset(formValuesFor(item))
      setDirection(directionOf(item?.expectedAmount ?? -1))
      setAmountText(absoluteText(item?.expectedAmount ?? 0))
      tester.reset()
    }
    setOpen(next)
  }

  function updateAmount(nextDirection: Direction, text: string) {
    setDirection(nextDirection)
    setAmountText(text)
    form.setValue("expectedAmount", signedAmount(nextDirection, amountFromText(text)), {
      shouldValidate: form.formState.isSubmitted,
    })
  }

  function changePeriodicity(periodicity: Periodicity) {
    form.setValue("periodicity", periodicity)
    form.setValue("dueMonth", defaultDueMonth(periodicity, form.getValues("dueMonth")))
  }

  function toggleRule(enabled: boolean) {
    form.setValue("rule", enabled ? emptyRule(form.getValues("name").trim()) : null)
    tester.reset()
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{item ? t("fixedItemsUi.dialog.editTitle") : t("fixedItemsUi.dialog.newTitle")}</DialogTitle>
          <DialogDescription>{t("fixedItemsUi.dialog.description")}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((input) => save.mutate(input))} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>{t("fixedItemsUi.dialog.name")}</FormLabel>
                    <FormControl>
                      <Input placeholder={t("fixedItemsUi.dialog.namePlaceholder")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="space-y-2">
                <Label>{t("fixedItemsUi.dialog.type")}</Label>
                <DirectionToggle value={direction} onChange={(next) => updateAmount(next, amountText)} />
              </div>
              <FormField
                control={form.control}
                name="expectedAmount"
                render={() => (
                  <FormItem>
                    <FormLabel>{t("fixedItemsUi.dialog.expectedAmount")}</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        placeholder="0.00"
                        value={amountText}
                        onChange={(event) => updateAmount(direction, event.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <ScheduleFields control={form.control} onPeriodicityChange={changePeriodicity} />
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("fixedItemsUi.dialog.category")}</FormLabel>
                  <FormControl>
                    <CreatableCategorySelect
                      value={field.value ?? NO_CATEGORY}
                      onChange={(value) => field.onChange(value === NO_CATEGORY ? null : value)}
                      extraOptions={[{ value: NO_CATEGORY, label: t("fixedItemsUi.dialog.noCategory") }]}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FixedItemRuleSection control={form.control} tester={tester} onToggle={toggleRule} />
            <DialogFooter className="sticky bottom-0 -mx-6 -mb-6 border-t bg-background px-6 py-4">
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  {t("common.cancel")}
                </Button>
              </DialogClose>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? t("fixedItemsUi.dialog.saving") : t("fixedItemsUi.dialog.save")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

function DirectionToggle({ value, onChange }: { value: Direction; onChange: (value: Direction) => void }) {
  const { t } = useTranslation()
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      aria-label={t("fixedItemsUi.dialog.type")}
      value={value}
      onValueChange={(next) => next !== "" && onChange(next as Direction)}
      className="w-full"
    >
      {DIRECTIONS.map((direction) => (
        <ToggleGroupItem key={direction} value={direction} className="flex-1">
          {t(`fixedItemsUi.direction.${direction}`)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

type ScheduleFieldsProps = {
  control: FixedItemControl
  onPeriodicityChange: (periodicity: Periodicity) => void
}

function ScheduleFields({ control, onPeriodicityChange }: ScheduleFieldsProps) {
  const { t } = useTranslation()
  const periodicity = useWatch({ control, name: "periodicity" })
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField
        control={control}
        name="periodicity"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("fixedItemsUi.dialog.periodicity")}</FormLabel>
            <Select value={field.value} onValueChange={(value) => isPeriodicity(value) && onPeriodicityChange(value)}>
              <FormControl>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {PERIODICITIES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {periodicityLabels[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="dueDay"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("fixedItemsUi.dialog.dueDay")}</FormLabel>
            <FormControl>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={31}
                step={1}
                placeholder="1"
                name={field.name}
                ref={field.ref}
                onBlur={field.onBlur}
                value={field.value ?? ""}
                onChange={(event) => field.onChange(toOptionalInteger(event.target.value))}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      {periodicity !== "monthly" && <DueMonthField control={control} periodicity={periodicity} />}
      <FormField
        control={control}
        name="startDate"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("fixedItemsUi.dialog.startDate")}</FormLabel>
            <FormControl>
              <Input type="date" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="endDate"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("fixedItemsUi.dialog.endDate")}</FormLabel>
            <FormControl>
              <Input
                type="date"
                name={field.name}
                ref={field.ref}
                onBlur={field.onBlur}
                value={field.value ?? ""}
                onChange={(event) => field.onChange(event.target.value === "" ? null : event.target.value)}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}

function DueMonthField({ control, periodicity }: { control: FixedItemControl; periodicity: Periodicity }) {
  const { t } = useTranslation()
  const labels: readonly string[] = periodicity === "quarterly" ? getQuarterMonthLabels() : getMonthLabels()
  return (
    <FormField
      control={control}
      name="dueMonth"
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t("fixedItemsUi.dialog.dueMonth")}</FormLabel>
          <Select value={field.value === null ? "" : String(field.value)} onValueChange={(value) => field.onChange(Number(value))}>
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("fixedItemsUi.dialog.chooseMonth")} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {labels.map((label, index) => (
                <SelectItem key={label} value={String(index + 1)}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
