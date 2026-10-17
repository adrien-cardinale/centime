import {
  BUDGET_KINDS,
  type BudgetKind,
  type BudgetPayload,
  budgetPayloadSchema,
  PERIODICITIES,
  type Periodicity,
} from "@centime/core"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
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
} from "@/components/ui/dialog"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { usePlannedCategoryIds } from "@/hooks/use-planned-category-ids"
import { api } from "@/lib/api"
import { defaultStartDate } from "@/lib/budgets"
import { parseAmountInput } from "@/lib/format"
import { periodicityLabels } from "@/lib/labels"
import { invalidatePlanEdits } from "@/lib/queries"
import {
  type BudgetDialogTarget,
  type BudgetFormValues,
  type EditableBudget,
  emptyRule,
  formValuesFor,
} from "./budget-form-values"
import { BudgetRuleSection } from "./budget-rule-section"

export type { BudgetDialogTarget } from "./budget-form-values"

type BudgetControl = Control<BudgetFormValues, unknown, BudgetPayload>

type BudgetDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: BudgetDialogTarget
}

function isPeriodicity(value: string): value is Periodicity {
  return PERIODICITIES.some((periodicity) => periodicity === value)
}

function isBudgetKind(value: string): value is BudgetKind {
  return BUDGET_KINDS.some((kind) => kind === value)
}

function saveBudget(budget: EditableBudget | undefined, input: BudgetPayload) {
  return budget ? api.budgets.update(budget.id, input) : api.budgets.create(input)
}

export function BudgetDialog({ open, onOpenChange, target }: BudgetDialogProps) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>{target.budget ? t("budgets.dialog.editTitle") : t("budgets.dialog.newTitle")}</DialogTitle>
          <DialogDescription>{t("budgets.dialog.description")}</DialogDescription>
        </DialogHeader>
        <BudgetForm target={target} onSaved={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function BudgetForm({ target, onSaved }: { target: BudgetDialogTarget; onSaved: () => void }) {
  const { t } = useTranslation()
  const [amountText, setAmountText] = useState(target.budget ? String(target.budget.amount) : "")
  const excludedIds = usePlannedCategoryIds(target.budget?.categoryId)
  const tester = useRuleTester()
  const queryClient = useQueryClient()
  const form = useForm<BudgetFormValues, unknown, BudgetPayload>({
    resolver: zodResolver(budgetPayloadSchema),
    defaultValues: formValuesFor(target),
  })
  const kind = useWatch({ control: form.control, name: "kind" }) ?? "envelope"

  const save = useMutation({
    mutationFn: (input: BudgetPayload) => saveBudget(target.budget, input),
    onSuccess: async (saved) => {
      await invalidatePlanEdits(queryClient)
      toast.success(t("budgets.dialog.saved", { name: saved.categoryName }))
      onSaved()
    },
    onError: (error) => toast.error(error.message),
  })

  function updateAmount(text: string) {
    setAmountText(text)
    form.setValue("amount", parseAmountInput(text) ?? Number.NaN, { shouldValidate: form.formState.isSubmitted })
  }

  function changeKind(next: BudgetKind) {
    form.setValue("kind", next)
    if (next === "income") form.setValue("rollover", false)
  }

  function changePeriod(period: Periodicity) {
    form.setValue("period", period)
    if (!target.budget) form.setValue("startDate", defaultStartDate(period))
  }

  function toggleRule(enabled: boolean) {
    form.setValue("rule", enabled ? emptyRule("") : null)
    tester.reset()
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((input) => save.mutate(input))} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 pb-6">
          <div className="space-y-2">
            <Label>{t("budgets.dialog.kind")}</Label>
            <KindToggle value={kind} onChange={changeKind} />
          </div>
          <FormField
            control={form.control}
            name="categoryId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("budgets.dialog.category")}</FormLabel>
                <FormControl>
                  <CreatableCategorySelect
                    value={field.value || undefined}
                    onChange={field.onChange}
                    excludeIds={excludedIds}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="amount"
              render={() => (
                <FormItem>
                  <FormLabel>{t("budgets.dialog.amount")}</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="0.00"
                      value={amountText}
                      onChange={(event) => updateAmount(event.target.value)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="period"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("budgets.dialog.periodicity")}</FormLabel>
                  <Select value={field.value} onValueChange={(value) => isPeriodicity(value) && changePeriod(value)}>
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
          </div>
          {kind === "envelope" && <RolloverField control={form.control} />}
          <BudgetRuleSection control={form.control} tester={tester} onToggle={toggleRule} />
        </div>
        <DialogFooter className="border-t px-6 py-4">
          <DialogClose asChild>
            <Button type="button" variant="outline">
              {t("common.cancel")}
            </Button>
          </DialogClose>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? t("budgets.dialog.saving") : t("budgets.dialog.save")}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  )
}

function KindToggle({ value, onChange }: { value: BudgetKind; onChange: (value: BudgetKind) => void }) {
  const { t } = useTranslation()
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      aria-label={t("budgets.dialog.kind")}
      value={value}
      onValueChange={(next) => isBudgetKind(next) && onChange(next)}
      className="w-full"
    >
      {BUDGET_KINDS.map((kind) => (
        <ToggleGroupItem key={kind} value={kind} className="flex-1">
          {t(`budgets.kind.${kind}`)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

function RolloverField({ control }: { control: BudgetControl }) {
  const { t } = useTranslation()
  return (
    <FormField
      control={control}
      name="rollover"
      render={({ field }) => (
        <FormItem className="relative flex min-h-11 items-start justify-between gap-4 rounded-md border p-3">
          <div className="space-y-1">
            <FormLabel className="cursor-pointer after:absolute after:inset-0">
              {t("budgets.dialog.rollover")}
            </FormLabel>
            <FormDescription>{t("budgets.dialog.rolloverHint")}</FormDescription>
          </div>
          <FormControl>
            <Switch className="relative" checked={field.value} onCheckedChange={field.onChange} />
          </FormControl>
        </FormItem>
      )}
    />
  )
}
