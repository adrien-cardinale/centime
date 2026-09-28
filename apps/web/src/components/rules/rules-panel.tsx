import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
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
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { api, type Category, type Rule } from "@/lib/api"
import { ruleFieldLabels, ruleMatchKindLabels } from "@/lib/labels"
import { categoriesQuery, rulesQuery } from "@/lib/queries"
import { ApplyRulesButton } from "./apply-rules-button"
import { RuleDialog } from "./rule-dialog"
import { RuleTarget } from "./rule-target"

export function RulesPanel() {
  const { data: rules, isPending, error } = useQuery(rulesQuery)
  const { data: categories = [] } = useQuery(categoriesQuery)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Les règles catégorisent les transactions à l'import. La priorité la plus haute l'emporte.
        </p>
        <div className="flex flex-wrap gap-2">
          <ApplyRulesButton />
          <RuleDialog
            trigger={
              <Button>
                <Plus />
                Nouvelle règle
              </Button>
            }
          />
        </div>
      </div>
      <Card className="py-0">
        <CardContent className="px-0">
          {isPending && <Skeleton className="m-6 h-5" />}
          {error && <p className="p-6 text-sm text-destructive">{error.message}</p>}
          {rules && <RulesTable rules={rules} categories={categories} />}
        </CardContent>
      </Card>
    </div>
  )
}

function RulesTable({ rules, categories }: { rules: Rule[]; categories: Category[] }) {
  if (rules.length === 0) {
    return <p className="p-6 text-center text-sm text-muted-foreground">Aucune règle.</p>
  }
  const categoriesById = new Map(categories.map((category) => [category.id, category]))

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-6 text-right">Priorité</TableHead>
          <TableHead>Motif</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Champ</TableHead>
          <TableHead>Cible</TableHead>
          <TableHead className="pr-6 text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rules.map((rule) => (
          <TableRow key={rule.id}>
            <TableCell className="pl-6 text-right tabular-nums">{rule.priority}</TableCell>
            <TableCell className="max-w-72 truncate font-mono text-xs" title={rule.pattern}>
              {rule.pattern}
            </TableCell>
            <TableCell>
              <Badge variant="outline">{ruleMatchKindLabels[rule.matchKind]}</Badge>
            </TableCell>
            <TableCell>{ruleFieldLabels[rule.field]}</TableCell>
            <TableCell>
              <RuleTarget rule={rule} categoriesById={categoriesById} />
            </TableCell>
            <TableCell className="pr-6">
              <div className="flex justify-end gap-1">
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
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
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
