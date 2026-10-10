import { type RulePayload, rulePayloadSchema } from "@centime/core"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { type ReactNode, useState } from "react"
import { type Control, useForm } from "react-hook-form"
import { toast } from "sonner"
import type { z } from "zod"
import { CreatableCategorySelect } from "@/components/categories/creatable-category-select"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { api, type Rule } from "@/lib/api"
import { invalidateTransactionData, rulesQuery } from "@/lib/queries"
import { MatchKindSelect, RuleFieldSelect, RuleTester, useRuleTester } from "./rule-matcher-inputs"
import { useTranslation } from "react-i18next"

export type RuleFormValues = z.input<typeof rulePayloadSchema>
type RuleControl = Control<RuleFormValues, unknown, RulePayload>

const NO_CATEGORY = "none"
const DEFAULT_USER_RULE_PRIORITY = 50

const EMPTY_RULE: RuleFormValues = {
  pattern: "",
  matchKind: "contains",
  field: "raw_label",
  categoryId: null,
  fixedItemId: null,
  markAsTransfer: false,
  priority: DEFAULT_USER_RULE_PRIORITY,
}

type RuleDialogProps = {
  rule?: Rule
  initialValues?: Partial<RuleFormValues>
  trigger?: ReactNode
  applyAfterCreate?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

function formValuesFor(rule: Rule | undefined, initialValues: Partial<RuleFormValues> | undefined): RuleFormValues {
  if (!rule) return { ...EMPTY_RULE, ...initialValues }
  return {
    pattern: rule.pattern,
    matchKind: rule.matchKind,
    field: rule.field,
    categoryId: rule.categoryId,
    fixedItemId: rule.fixedItemId,
    markAsTransfer: rule.markAsTransfer,
    priority: rule.priority,
  }
}

function saveRule(rule: Rule | undefined, input: RulePayload) {
  return rule ? api.rules.update(rule.id, input) : api.rules.create(input)
}

export function RuleDialog({ rule, initialValues, trigger, applyAfterCreate, open, onOpenChange }: RuleDialogProps) {
  const { t } = useTranslation()
  const [internalOpen, setInternalOpen] = useState(false)
  const isOpen = open ?? internalOpen
  const queryClient = useQueryClient()
  const defaults = formValuesFor(rule, initialValues)
  const form = useForm<RuleFormValues, unknown, RulePayload>({
    resolver: zodResolver(rulePayloadSchema),
    defaultValues: defaults,
  })

  const tester = useRuleTester()

  const save = useMutation({
    mutationFn: async (input: RulePayload) => {
      const saved = await saveRule(rule, input)
      const applied = !rule && applyAfterCreate ? await api.rules.apply("all") : null
      return { saved, applied }
    },
    onSuccess: async ({ applied }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: rulesQuery.queryKey }),
        invalidateTransactionData(queryClient),
      ])
      toast.success(
        rule ? t("rules.dialog.updated") : t("rules.dialog.created"),
        applied ? { description: t("rules.dialog.categorized", { count: applied.categorized }) } : undefined,
      )
      changeOpen(false)
    },
    onError: (error) => toast.error(error.message),
  })

  function changeOpen(next: boolean) {
    if (next) {
      form.reset(defaults)
      tester.reset()
    }
    setInternalOpen(next)
    onOpenChange?.(next)
  }

  return (
    <Dialog open={isOpen} onOpenChange={changeOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{rule ? t("rules.dialog.editTitle") : t("rules.dialog.newTitle")}</DialogTitle>
          <DialogDescription>
            {t("rules.dialog.description")}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((input) => save.mutate(input))} className="space-y-6">
            <MatcherFields control={form.control} />
            <TargetFields control={form.control} />
            <RuleTester tester={tester} getMatcher={() => form.getValues()} />
            <DialogFooter className="sticky bottom-0 -mx-6 -mb-6 border-t bg-background px-6 py-4">
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  {t("common.cancel")}
                </Button>
              </DialogClose>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? t("categories.form.saving") : t("categories.form.save")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

function MatcherFields({ control }: { control: RuleControl }) {
  const { t } = useTranslation()
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField
        control={control}
        name="pattern"
        render={({ field }) => (
          <FormItem className="sm:col-span-2">
            <FormLabel>{t("rules.dialog.pattern")}</FormLabel>
            <FormControl>
              <Input
                placeholder="Migros"
                className="font-mono"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                {...field}
              />
            </FormControl>
            <FormDescription>{t("rules.dialog.patternHint")}</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="matchKind"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("rules.dialog.type")}</FormLabel>
            <FormControl>
              <MatchKindSelect value={field.value} onChange={field.onChange} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="field"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("rules.dialog.field")}</FormLabel>
            <FormControl>
              <RuleFieldSelect value={field.value} onChange={field.onChange} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}

function TargetFields({ control }: { control: RuleControl }) {
  const { t } = useTranslation()
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField
        control={control}
        name="categoryId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("rules.dialog.category")}</FormLabel>
            <FormControl>
              <CreatableCategorySelect
                value={field.value ?? NO_CATEGORY}
                onChange={(value) => field.onChange(value === NO_CATEGORY ? null : value)}
                extraOptions={[{ value: NO_CATEGORY, label: t("rules.dialog.noCategory") }]}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="priority"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("rules.dialog.priority")}</FormLabel>
            <FormControl>
              <Input
                type="number"
                inputMode="numeric"
                step={1}
                name={field.name}
                ref={field.ref}
                onBlur={field.onBlur}
                value={field.value}
                onChange={(event) => field.onChange(event.target.value === "" ? 0 : Number(event.target.value))}
              />
            </FormControl>
            <FormDescription>{t("rules.dialog.priorityHint")}</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="markAsTransfer"
        render={({ field }) => (
          <FormItem className="flex items-center gap-2 sm:col-span-2">
            <FormControl>
              <Checkbox checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} />
            </FormControl>
            <FormLabel>{t("rules.dialog.markAsTransfer")}</FormLabel>
          </FormItem>
        )}
      />
    </div>
  )
}
