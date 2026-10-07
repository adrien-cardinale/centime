import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Pencil, Plus, Trash2 } from "lucide-react"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { api, type Category, type Rule } from "@/lib/api"
import { ruleFieldLabels, ruleMatchKindLabels } from "@/lib/labels"
import { rulesQuery } from "@/lib/queries"
import { RuleDialog } from "./rule-dialog"
import { RuleTarget } from "./rule-target"
import { useTranslation } from "react-i18next"

type RuleListProps = {
  rules: Rule[]
  categoriesById: Map<string, Category>
  /** Catégorie préremplie pour « Ajouter une règle ». Absente pour les règles sans catégorie. */
  categoryId?: string
}

export function RuleList({ rules, categoriesById, categoryId }: RuleListProps) {
  const { t } = useTranslation()
  return (
    <div className="space-y-1">
      {rules.length === 0 && <p className="py-1 text-sm text-muted-foreground">{t("rules.empty")}</p>}
      {rules.map((rule) => (
        <RuleItem key={rule.id} rule={rule} categoriesById={categoriesById} showTarget={!categoryId} />
      ))}
      <RuleDialog
        applyAfterCreate
        initialValues={{ categoryId: categoryId ?? null }}
        trigger={
          <Button variant="ghost" size="sm" className="-ml-2">
            <Plus />
            {t("rules.add")}
          </Button>
        }
      />
    </div>
  )
}

function RuleItem({
  rule,
  categoriesById,
  showTarget,
}: {
  rule: Rule
  categoriesById: Map<string, Category>
  showTarget: boolean
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md py-1 text-sm">
      <span className="max-w-72 truncate font-mono text-xs" title={rule.pattern}>
        {rule.pattern}
      </span>
      <Badge variant="outline">{ruleMatchKindLabels[rule.matchKind]}</Badge>
      <span className="text-muted-foreground">{ruleFieldLabels[rule.field]}</span>
      <span className="text-muted-foreground tabular-nums">{t("rules.priorityValue", { priority: rule.priority })}</span>
      {showTarget && <RuleTarget rule={rule} categoriesById={categoriesById} />}
      <div className="ml-auto flex gap-1">
        <RuleDialog
          rule={rule}
          trigger={
            <Button variant="ghost" size="icon" aria-label={t("rules.edit", { pattern: rule.pattern })}>
              <Pencil />
            </Button>
          }
        />
        <DeleteRuleButton rule={rule} />
      </div>
    </div>
  )
}

function DeleteRuleButton({ rule }: { rule: Rule }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const remove = useMutation({
    mutationFn: () => api.rules.remove(rule.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: rulesQuery.queryKey })
      toast.success(t("rules.deleted"))
    },
    onError: (error) => toast.error(error.message),
  })

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("rules.delete", { pattern: rule.pattern })}>
          <Trash2 />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("rules.deleteTitle", { pattern: rule.pattern })}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("rules.deleteDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={() => remove.mutate()}>{t("rules.confirmDelete")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
