import type { BudgetPayload } from "@centime/core"
import { useTranslation } from "react-i18next"
import { type Control, useWatch } from "react-hook-form"
import { MatchKindSelect, RuleFieldSelect, RuleTester, useRuleTester } from "@/components/rules/rule-matcher-inputs"
import { Checkbox } from "@/components/ui/checkbox"
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { BudgetFormValues } from "./budget-form-values"

type BudgetControl = Control<BudgetFormValues, unknown, BudgetPayload>

type RuleSectionProps = {
  control: BudgetControl
  tester: ReturnType<typeof useRuleTester>
  onToggle: (enabled: boolean) => void
}

export function BudgetRuleSection({ control, tester, onToggle }: RuleSectionProps) {
  const { t } = useTranslation()
  const rule = useWatch({ control, name: "rule" })
  const enabled = rule !== null && rule !== undefined

  return (
    <fieldset className="space-y-4 rounded-md border p-4">
      <legend className="px-1 text-sm font-medium">{t("budgets.rule.legend")}</legend>
      <Label htmlFor="rule-enabled" className="flex min-h-11 cursor-pointer items-center gap-3 font-normal">
        <Checkbox id="rule-enabled" checked={enabled} onCheckedChange={(checked) => onToggle(checked === true)} />
        {t("budgets.rule.autoLink")}
      </Label>
      {enabled && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={control}
              name="rule.pattern"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>{t("budgets.rule.pattern")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("budgets.rule.patternPlaceholder")} className="font-mono" {...field} />
                  </FormControl>
                  <FormDescription>{t("budgets.rule.patternHint")}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="rule.matchKind"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("budgets.rule.type")}</FormLabel>
                  <FormControl>
                    <MatchKindSelect value={field.value ?? "contains"} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="rule.field"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("budgets.rule.field")}</FormLabel>
                  <FormControl>
                    <RuleFieldSelect value={field.value ?? "raw_label"} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <RuleTester tester={tester} getMatcher={() => rule} />
        </>
      )}
    </fieldset>
  )
}
