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

type RuleListProps = {
  rules: Rule[]
  categoriesById: Map<string, Category>
  /** Catégorie préremplie pour « Ajouter une règle ». Absente pour les règles sans catégorie. */
  categoryId?: string
}

export function RuleList({ rules, categoriesById, categoryId }: RuleListProps) {
  return (
    <div className="space-y-1">
      {rules.length === 0 && <p className="py-1 text-sm text-muted-foreground">Aucune règle pour cette catégorie.</p>}
      {rules.map((rule) => (
        <RuleItem key={rule.id} rule={rule} categoriesById={categoriesById} showTarget={!categoryId} />
      ))}
      <RuleDialog
        applyAfterCreate
        initialValues={{ categoryId: categoryId ?? null }}
        trigger={
          <Button variant="ghost" size="sm" className="-ml-2">
            <Plus />
            Ajouter une règle
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
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md py-1 text-sm">
      <span className="max-w-72 truncate font-mono text-xs" title={rule.pattern}>
        {rule.pattern}
      </span>
      <Badge variant="outline">{ruleMatchKindLabels[rule.matchKind]}</Badge>
      <span className="text-muted-foreground">{ruleFieldLabels[rule.field]}</span>
      <span className="text-muted-foreground tabular-nums">· priorité {rule.priority}</span>
      {showTarget && <RuleTarget rule={rule} categoriesById={categoriesById} />}
      <div className="ml-auto flex gap-1">
        <RuleDialog
          rule={rule}
          trigger={
            <Button variant="ghost" size="icon" aria-label={`Modifier la règle ${rule.pattern}`}>
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
  const queryClient = useQueryClient()
  const remove = useMutation({
    mutationFn: () => api.rules.remove(rule.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: rulesQuery.queryKey })
      toast.success("Règle supprimée")
    },
    onError: (error) => toast.error(error.message),
  })

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Supprimer la règle ${rule.pattern}`}>
          <Trash2 />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer la règle « {rule.pattern} » ?</AlertDialogTitle>
          <AlertDialogDescription>
            Elle ne s'appliquera plus aux prochains imports. Les transactions déjà catégorisées sont conservées.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={() => remove.mutate()}>Supprimer</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
