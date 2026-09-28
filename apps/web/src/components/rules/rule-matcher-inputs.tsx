import { RULE_FIELDS, RULE_MATCH_KINDS, type RuleField, type RuleMatchKind, ruleMatcherSchema } from "@centime/core"
import { useMutation } from "@tanstack/react-query"
import { FlaskConical } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { api } from "@/lib/api"
import { ruleFieldLabels, ruleMatchKindLabels } from "@/lib/labels"
import { RuleTestResults } from "./rule-test-results"

type OptionSelectProps<Value extends string> = {
  value: Value
  onChange: (value: Value) => void
  id?: string
}

function isOneOf<Value extends string>(options: readonly Value[], value: string): value is Value {
  return options.some((option) => option === value)
}

export function MatchKindSelect({ value, onChange, id }: OptionSelectProps<RuleMatchKind>) {
  return (
    <Select value={value} onValueChange={(next) => isOneOf(RULE_MATCH_KINDS, next) && onChange(next)}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {RULE_MATCH_KINDS.map((kind) => (
          <SelectItem key={kind} value={kind}>
            {ruleMatchKindLabels[kind]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function RuleFieldSelect({ value, onChange, id }: OptionSelectProps<RuleField>) {
  return (
    <Select value={value} onValueChange={(next) => isOneOf(RULE_FIELDS, next) && onChange(next)}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {RULE_FIELDS.map((ruleField) => (
          <SelectItem key={ruleField} value={ruleField}>
            {ruleFieldLabels[ruleField]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function useRuleTester() {
  const test = useMutation({
    mutationFn: api.rules.test,
    onError: (error) => toast.error(error.message),
  })

  function run(candidate: unknown) {
    const parsed = ruleMatcherSchema.safeParse(candidate)
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Motif invalide")
      return
    }
    test.mutate(parsed.data)
  }

  return { run, reset: test.reset, isPending: test.isPending, result: test.data }
}

type RuleTesterProps = {
  tester: ReturnType<typeof useRuleTester>
  getMatcher: () => unknown
}

export function RuleTester({ tester, getMatcher }: RuleTesterProps) {
  return (
    <div className="space-y-3">
      <Button type="button" variant="outline" onClick={() => tester.run(getMatcher())} disabled={tester.isPending}>
        <FlaskConical />
        {tester.isPending ? "Test en cours…" : "Tester"}
      </Button>
      {tester.result && <RuleTestResults result={tester.result} />}
    </div>
  )
}
