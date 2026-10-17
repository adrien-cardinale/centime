import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import i18n from "@/i18n"
import { api, type AutoRuleResult } from "@/lib/api"
import { rulesQuery } from "@/lib/queries"
import { useAutoRuleSetting } from "@/lib/rules/auto-rule-settings"

function announceCreated({ created }: AutoRuleResult): void {
  const pattern = created.map((rule) => rule.pattern).join(", ")
  toast.success(i18n.t("rules.auto.created", { count: created.length, pattern }))
}

export function useAutoRules(): (ids: string[]) => Promise<boolean> {
  const queryClient = useQueryClient()
  const { enabled } = useAutoRuleSetting()

  return async (ids) => {
    if (!enabled || ids.length === 0) return false
    try {
      const result = await api.rules.autoCreate({ ids })
      if (result.created.length === 0) return false
      await queryClient.invalidateQueries({ queryKey: rulesQuery.queryKey })
      announceCreated(result)
      return true
    } catch {
      toast.error(i18n.t("rules.auto.failed"))
      return false
    }
  }
}
