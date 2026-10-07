import type { FixedItemPayload } from "@centime/core"
import { type Control, useWatch } from "react-hook-form"
import { MatchKindSelect, RuleFieldSelect, RuleTester, useRuleTester } from "@/components/rules/rule-matcher-inputs"
import { Checkbox } from "@/components/ui/checkbox"
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { FixedItemFormValues } from "./fixed-item-form"

type FixedItemControl = Control<FixedItemFormValues, unknown, FixedItemPayload>

type RuleSectionProps = {
  control: FixedItemControl
  tester: ReturnType<typeof useRuleTester>
  onToggle: (enabled: boolean) => void
}

export function FixedItemRuleSection({ control, tester, onToggle }: RuleSectionProps) {
  const rule = useWatch({ control, name: "rule" })
  const enabled = rule !== null && rule !== undefined

  return (
    <fieldset className="space-y-4 rounded-md border p-4">
      <legend className="px-1 text-sm font-medium">Règle de rapprochement</legend>
      <div className="flex items-center gap-2">
        <Checkbox id="rule-enabled" checked={enabled} onCheckedChange={(checked) => onToggle(checked === true)} />
        <Label htmlFor="rule-enabled" className="font-normal">
          Rattacher automatiquement les transactions
        </Label>
      </div>
      {enabled && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={control}
              name="rule.pattern"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Motif</FormLabel>
                  <FormControl>
                    <Input placeholder="Régie" className="font-mono" {...field} />
                  </FormControl>
                  <FormDescription>« contient » ignore la casse et les accents.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="rule.matchKind"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
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
                  <FormLabel>Champ</FormLabel>
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
