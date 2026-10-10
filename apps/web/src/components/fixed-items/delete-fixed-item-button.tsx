import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Trash2 } from "lucide-react"
import type { ReactNode } from "react"
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { api, type FixedItem } from "@/lib/api"
import { invalidateFixedItemData } from "@/lib/queries"

type DeleteFixedItemButtonProps = {
  item: FixedItem
  trigger?: ReactNode
  onDeleted?: () => void
}

export function DeleteFixedItemButton({ item, trigger, onDeleted }: DeleteFixedItemButtonProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const remove = useMutation({
    mutationFn: () => api.fixedItems.remove(item.id),
    onSuccess: async () => {
      await invalidateFixedItemData(queryClient)
      toast.success(t("fixedItemsUi.delete.deleted", { name: item.name }))
      onDeleted?.()
    },
    onError: (error) => toast.error(error.message),
  })

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="icon" aria-label={t("fixedItemsUi.delete.label", { name: item.name })} disabled={remove.isPending}>
            <Trash2 />
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("fixedItemsUi.delete.title", { name: item.name })}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("fixedItemsUi.delete.description")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={() => remove.mutate()}>{t("fixedItemsUi.delete.confirm")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
