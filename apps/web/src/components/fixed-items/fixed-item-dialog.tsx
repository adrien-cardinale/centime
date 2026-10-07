import { type FixedItemPayload, fixedItemPayloadSchema, PERIODICITIES, type Periodicity } from "@centime/core"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { type ReactNode, useState } from "react"
import { type Control, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { CreatableCategorySelect } from "@/components/categories/creatable-category-select"
import { useRuleTester } from "@/components/rules/rule-matcher-inputs"
import { Button } from "@/components/ui/button"
import {
  Dialog,
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
import { defaultDueMonth, emptyRule, type FixedItemFormValues, formValuesFor, NO_CATEGORY } from "./fixed-item-form"
import { FixedItemRuleSection } from "./fixed-item-rule-section"

type FixedItemControl = Control<FixedItemFormValues, unknown, FixedItemPayload>

type FixedItemDialogProps = {
  item?: FixedItem
  trigger: ReactNode
}

const DIRECTIONS = ["expense", "income"] as const satisfies readonly Direction[]
const directionLabels: Record<Direction, string> = { expense: "Dépense", income: "Revenu" }

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
      toast.success(`Poste « ${saved.name} » enregistré`, {
        description: `${saved.linkedCount} transaction${saved.linkedCount > 1 ? "s" : ""} rattachée${saved.linkedCount > 1 ? "s" : ""}`,
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
    form.setValue("expectedAmount", signedAmount(nextDirection, Number(text === "" ? 0 : text)), {
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{item ? "Modifier le poste fixe" : "Nouveau poste fixe"}</DialogTitle>
          <DialogDescription>Une dépense ou un revenu récurrent, avec son montant attendu et son échéance.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((input) => save.mutate(input))} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Nom</FormLabel>
                    <FormControl>
                      <Input placeholder="Loyer" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="space-y-2">
                <Label>Type</Label>
                <DirectionToggle value={direction} onChange={(next) => updateAmount(next, amountText)} />
              </div>
              <FormField
                control={form.control}
                name="expectedAmount"
                render={() => (
                  <FormItem>
                    <FormLabel>Montant attendu</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.01"
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
                  <FormLabel>Catégorie</FormLabel>
                  <FormControl>
                    <CreatableCategorySelect
                      value={field.value ?? NO_CATEGORY}
                      onChange={(value) => field.onChange(value === NO_CATEGORY ? null : value)}
                      extraOptions={[{ value: NO_CATEGORY, label: "Aucune" }]}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FixedItemRuleSection control={form.control} tester={tester} onToggle={toggleRule} />
            <DialogFooter>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

function DirectionToggle({ value, onChange }: { value: Direction; onChange: (value: Direction) => void }) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      aria-label="Type"
      value={value}
      onValueChange={(next) => next !== "" && onChange(next as Direction)}
      className="w-full"
    >
      {DIRECTIONS.map((direction) => (
        <ToggleGroupItem key={direction} value={direction} className="flex-1">
          {directionLabels[direction]}
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
  const periodicity = useWatch({ control, name: "periodicity" })
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField
        control={control}
        name="periodicity"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Périodicité</FormLabel>
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
            <FormLabel>Jour d'échéance</FormLabel>
            <FormControl>
              <Input
                type="number"
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
            <FormLabel>Date de début</FormLabel>
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
            <FormLabel>Date de fin (facultative)</FormLabel>
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
  const labels: readonly string[] = periodicity === "quarterly" ? getQuarterMonthLabels() : getMonthLabels()
  return (
    <FormField
      control={control}
      name="dueMonth"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Mois d'échéance</FormLabel>
          <Select value={field.value === null ? "" : String(field.value)} onValueChange={(value) => field.onChange(Number(value))}>
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choisir un mois" />
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
