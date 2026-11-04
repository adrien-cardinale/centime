import { type PeriodRange, periodContaining, stopDateFor } from "@centime/core"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { CircleStop, Trash2 } from "lucide-react"
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
import { api, type Budget } from "@/lib/api"
import { invalidateBudgetData } from "@/lib/queries"

type DeleteBudgetDialogProps = {
  budget: Pick<Budget, "id" | "categoryName" | "period" | "startDate">
  month: PeriodRange
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DeleteBudgetDialog({ budget, month, open, onOpenChange }: DeleteBudgetDialogProps) {
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
  const stop = useMutation({
    mutationFn: () => api.budgets.stop(budget.id, month.start),
    onSuccess: async () => {
      await invalidateBudgetData(queryClient)
      toast.success(t("budgets.delete.stopped", { name: budget.categoryName }))
    },
    onError: (error) => toast.error(error.message),
  })
  const canStop = stopDateFor(budget.period, budget.startDate, month.start) !== null
  const isPending = remove.isPending || stop.isPending

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t(canStop ? "budgets.delete.stopTitle" : "budgets.delete.title", { name: budget.categoryName })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {canStop
              ? t("budgets.delete.stopDescription", { period: periodContaining(budget.period, month.start).label })
              : t("budgets.delete.description")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            variant={canStop ? "destructive" : "default"}
            onClick={() => remove.mutate()}
            disabled={isPending}
          >
            <Trash2 />
            {t(canStop ? "budgets.delete.deleteForever" : "budgets.delete.confirm")}
          </AlertDialogAction>
          {canStop && (
            <AlertDialogAction onClick={() => stop.mutate()} disabled={isPending}>
              <CircleStop />
              {t("budgets.delete.stop")}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
