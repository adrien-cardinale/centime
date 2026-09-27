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
import { api, type ApplyRulesResult, type ApplyRulesScope } from "@/lib/api"
import { invalidateTransactionData } from "@/lib/queries"

const scopeLabels: Record<ApplyRulesScope, string> = {
  uncategorized: "Transactions non catégorisées",
  all: "Toutes les transactions",
}

function isScope(value: string): value is ApplyRulesScope {
  return value in scopeLabels
}

function summary(result: ApplyRulesResult): string {
  return `${result.examined} examinée(s), ${result.categorized} catégorisée(s), ${result.markedAsTransfer} marquée(s) comme transfert, ${result.linkedToFixedItem} rattachée(s) à un poste fixe`
}

export function ApplyRulesButton() {
  const [scope, setScope] = useState<ApplyRulesScope>("uncategorized")
  const queryClient = useQueryClient()
  const apply = useMutation({
    mutationFn: () => api.rules.apply(scope),
    onSuccess: async (result) => {
      await invalidateTransactionData(queryClient)
      toast.success("Règles réappliquées", { description: summary(result) })
    },
    onError: (error) => toast.error(error.message),
  })

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" disabled={apply.isPending}>
          <RefreshCw />
          Réappliquer les règles
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Réappliquer les règles ?</AlertDialogTitle>
          <AlertDialogDescription>
            Sur « toutes les transactions », une règle correspondante remplace la catégorie actuelle. Une transaction
            sans règle correspondante garde sa catégorie.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor="apply-scope">Portée</Label>
          <Select value={scope} onValueChange={(value) => isScope(value) && setScope(value)}>
            <SelectTrigger id="apply-scope" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(scopeLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={() => apply.mutate()}>Réappliquer</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
