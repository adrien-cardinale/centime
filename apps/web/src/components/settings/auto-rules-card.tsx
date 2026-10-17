import { AUTO_RULE_THRESHOLD } from "@centime/services"
import { useId } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { useAutoRuleSetting, useSaveAutoRuleSetting } from "@/lib/rules/auto-rule-settings"

export function AutoRulesCard() {
  const { t } = useTranslation()
  const { enabled, isLoading } = useAutoRuleSetting()
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.autoRules.title")}</CardTitle>
        <CardDescription>{t("settings.autoRules.description", { count: AUTO_RULE_THRESHOLD })}</CardDescription>
      </CardHeader>
      <CardContent>{isLoading ? <Skeleton className="h-6 w-48" /> : <AutoRulesSwitch enabled={enabled} />}</CardContent>
    </Card>
  )
}

function AutoRulesSwitch({ enabled }: { enabled: boolean }) {
  const { t } = useTranslation()
  const id = useId()
  const save = useSaveAutoRuleSetting()

  const toggle = (next: boolean) =>
    save.mutate(next, { onError: () => toast.error(t("settings.autoRules.saveFailed")) })

  return (
    <div className="flex items-center gap-3">
      <Switch id={id} checked={enabled} disabled={save.isPending} onCheckedChange={toggle} />
      <Label htmlFor={id}>{t("settings.autoRules.enable")}</Label>
    </div>
  )
}
