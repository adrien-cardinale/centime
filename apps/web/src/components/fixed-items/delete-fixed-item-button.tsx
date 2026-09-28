import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Trash2 } from "lucide-react"
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

export function DeleteFixedItemButton({ item }: { item: FixedItem }) {
  const queryClient = useQueryClient()
  const remove = useMutation({
    mutationFn: () => api.fixedItems.remove(item.id),
    onSuccess: async () => {
      await invalidateFixedItemData(queryClient)
      toast.success(`Poste « ${item.name} » supprimé`)
    },
    onError: (error) => toast.error(error.message),
  })

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Supprimer ${item.name}`} disabled={remove.isPending}>
          <Trash2 />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer le poste « {item.name} » ?</AlertDialogTitle>
          <AlertDialogDescription>
            Les transactions rattachées sont conservées mais détachées du poste. Sa règle de rapprochement est
            supprimée.
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
