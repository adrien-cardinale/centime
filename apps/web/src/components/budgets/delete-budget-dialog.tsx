import { useMutation, useQueryClient } from "@tanstack/react-query"
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
} from "@/components/ui/alert-dialog"
import { api, type BudgetOverviewItem } from "@/lib/api"
import { invalidateBudgetData } from "@/lib/queries"

type DeleteBudgetDialogProps = {
  budget: BudgetOverviewItem
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DeleteBudgetDialog({ budget, open, onOpenChange }: DeleteBudgetDialogProps) {
  const queryClient = useQueryClient()
  const remove = useMutation({
    mutationFn: () => api.budgets.remove(budget.id),
    onSuccess: async () => {
      await invalidateBudgetData(queryClient)
      toast.success(`Budget « ${budget.categoryName} » supprimé`)
    },
    onError: (error) => toast.error(error.message),
  })

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer le budget « {budget.categoryName} » ?</AlertDialogTitle>
          <AlertDialogDescription>
            Les transactions de la catégorie sont conservées. Seul le plafond et son suivi disparaissent.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={() => remove.mutate()} disabled={remove.isPending}>
            Supprimer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
