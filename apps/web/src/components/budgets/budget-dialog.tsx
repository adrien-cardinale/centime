import { type BudgetPayload, budgetPayloadSchema, PERIODICITIES, type Periodicity } from "@centime/core"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import type { z } from "zod"
import { CategorySelect } from "@/components/categories/category-select"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { api, type Budget } from "@/lib/api"
import { defaultStartDate } from "@/lib/budgets"
import { periodicityLabels } from "@/lib/labels"
import { budgetsQuery, invalidateBudgetData } from "@/lib/queries"

type BudgetFormValues = z.input<typeof budgetPayloadSchema>

type EditableBudget = Pick<Budget, "id" | "categoryId" | "amount" | "period" | "rollover" | "startDate">

export type BudgetDialogTarget = { budget?: EditableBudget; categoryId?: string }

type BudgetDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: BudgetDialogTarget
}

function formValuesFor({ budget, categoryId }: BudgetDialogTarget): BudgetFormValues {
  if (budget) {
    const { id: _id, ...values } = budget
    return values
  }
  return { categoryId: categoryId ?? "", amount: 0, period: "monthly", rollover: false, startDate: defaultStartDate("monthly") }
}

function isPeriodicity(value: string): value is Periodicity {
  return PERIODICITIES.some((periodicity) => periodicity === value)
}

function saveBudget(budget: EditableBudget | undefined, input: BudgetPayload) {
  return budget ? api.budgets.update(budget.id, input) : api.budgets.create(input)
}

export function BudgetDialog({ open, onOpenChange, target }: BudgetDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{target.budget ? "Modifier le budget" : "Nouveau budget"}</DialogTitle>
          <DialogDescription>Un plafond pour les dépenses variables d'une catégorie et de ses sous-catégories.</DialogDescription>
        </DialogHeader>
        <BudgetForm target={target} onSaved={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function useExcludedCategoryIds(budget: EditableBudget | undefined): string[] {
  const { data: budgets = [] } = useQuery(budgetsQuery)
  return budgets.map((entry) => entry.categoryId).filter((categoryId) => categoryId !== budget?.categoryId)
}

function BudgetForm({ target, onSaved }: { target: BudgetDialogTarget; onSaved: () => void }) {
  const [amountText, setAmountText] = useState(target.budget ? String(target.budget.amount) : "")
  const excludedIds = useExcludedCategoryIds(target.budget)
  const queryClient = useQueryClient()
  const form = useForm<BudgetFormValues, unknown, BudgetPayload>({
    resolver: zodResolver(budgetPayloadSchema),
    defaultValues: formValuesFor(target),
  })

  const save = useMutation({
    mutationFn: (input: BudgetPayload) => saveBudget(target.budget, input),
    onSuccess: async (saved) => {
      await invalidateBudgetData(queryClient)
      toast.success(`Budget « ${saved.categoryName} » enregistré`)
      onSaved()
    },
    onError: (error) => toast.error(error.message),
  })

  function updateAmount(text: string) {
    setAmountText(text)
    form.setValue("amount", text === "" ? Number.NaN : Number(text), { shouldValidate: form.formState.isSubmitted })
  }

  function changePeriod(period: Periodicity) {
    form.setValue("period", period)
    const startDateEdited = form.getFieldState("startDate", form.formState).isDirty
    if (!target.budget && !startDateEdited) form.setValue("startDate", defaultStartDate(period))
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((input) => save.mutate(input))} className="space-y-5">
        <FormField
          control={form.control}
          name="categoryId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Catégorie</FormLabel>
              <FormControl>
                <CategorySelect value={field.value || undefined} onChange={field.onChange} excludeIds={excludedIds} />
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
                <FormLabel>Montant</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
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
                <FormLabel>Périodicité</FormLabel>
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
        <FormField
          control={form.control}
          name="startDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Date de début</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="rollover"
          render={({ field }) => (
            <FormItem className="flex items-start justify-between gap-4 rounded-md border p-3">
              <div className="space-y-1">
                <FormLabel>Reporter le reliquat</FormLabel>
                <FormDescription>
                  Le solde des périodes précédentes, positif ou négatif, s'ajoute au plafond de la période en cours.
                </FormDescription>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />
        <DialogFooter>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  )
}
