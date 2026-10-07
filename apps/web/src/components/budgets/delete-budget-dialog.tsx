import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
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
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const remove = useMutation({
    mutationFn: () => api.budgets.remove(budget.id),
    onSuccess: async () => {
      await invalidateBudgetData(queryClient)
      toast.success(t("budgets.delete.deleted", { name: budget.categoryName }))
    },
    onError: (error) => toast.error(error.message),
  })

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("budgets.delete.title", { name: budget.categoryName })}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("budgets.delete.description")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={() => remove.mutate()} disabled={remove.isPending}>
            {t("budgets.delete.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
