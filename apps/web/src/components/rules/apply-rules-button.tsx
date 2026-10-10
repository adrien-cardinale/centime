import { useMutation, useQueryClient } from "@tanstack/react-query"
import { RefreshCw } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import i18n from "@/i18n"
import { api, type ApplyRulesResult, type ApplyRulesScope } from "@/lib/api"
import { invalidateTransactionData } from "@/lib/queries"
import { useTranslation } from "react-i18next"

const SCOPES: readonly ApplyRulesScope[] = ["uncategorized", "all"]

function isScope(value: string): value is ApplyRulesScope {
  return SCOPES.some((scope) => scope === value)
}

function summary(result: ApplyRulesResult): string {
  return i18n.t("rules.apply.summary", result)
}

export function ApplyRulesButton() {
  return <ApplyRulesDialog withTrigger />
}

type ApplyRulesDialogProps = {
  withTrigger?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function ApplyRulesDialog({ withTrigger = false, open, onOpenChange }: ApplyRulesDialogProps) {
  const { t } = useTranslation()
  const [scope, setScope] = useState<ApplyRulesScope>("uncategorized")
  const queryClient = useQueryClient()
  const apply = useMutation({
    mutationFn: () => api.rules.apply(scope),
    onSuccess: async (result) => {
      await invalidateTransactionData(queryClient)
      toast.success(i18n.t("rules.apply.done"), { description: summary(result) })
    },
    onError: (error) => toast.error(error.message),
  })

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {withTrigger && (
        <AlertDialogTrigger asChild>
          <Button variant="outline" disabled={apply.isPending}>
            <RefreshCw />
            {t("rules.apply.button")}
          </Button>
        </AlertDialogTrigger>
      )}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("rules.apply.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("rules.apply.description")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor="apply-scope">{t("rules.apply.scope")}</Label>
          <Select value={scope} onValueChange={(value) => isScope(value) && setScope(value)}>
            <SelectTrigger id="apply-scope" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCOPES.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`rules.apply.scopes.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={() => apply.mutate()}>{t("rules.apply.confirm")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
