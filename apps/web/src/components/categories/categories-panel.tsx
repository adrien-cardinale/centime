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
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { api, type Category } from "@/lib/api"
import { categoriesQuery, invalidateTransactionData, rulesQuery } from "@/lib/queries"
import { CategoryDialog } from "./category-dialog"
import { ColorDot } from "./color-dot"

export function CategoriesPanel() {
  const { data: categories, isPending, error } = useQuery(categoriesQuery)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">Les catégories regroupent vos dépenses et vos revenus.</p>
        <CategoryDialog
          trigger={
            <Button>
              <Plus />
              Nouvelle catégorie
            </Button>
          }
        />
      </div>
      <Card className="py-0">
        <CardContent className="px-0">
          {isPending && <Skeleton className="m-6 h-5" />}
          {error && <p className="p-6 text-sm text-destructive">{error.message}</p>}
          {categories && <CategoriesTable categories={categories} />}
        </CardContent>
      </Card>
    </div>
  )
}

function CategoriesTable({ categories }: { categories: Category[] }) {
  if (categories.length === 0) {
    return <p className="p-6 text-center text-sm text-muted-foreground">Aucune catégorie.</p>
  }
  const namesById = new Map(categories.map((category) => [category.id, category.name]))

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-6">Nom</TableHead>
          <TableHead>Parent</TableHead>
          <TableHead className="text-right">Transactions</TableHead>
          <TableHead className="pr-6 text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {categories.map((category) => (
          <TableRow key={category.id}>
            <TableCell className="pl-6 font-medium">
              <span className="flex items-center gap-2">
                <ColorDot color={category.color} className="size-3" />
                {category.name}
              </span>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {(category.parentId && namesById.get(category.parentId)) ?? "—"}
            </TableCell>
            <TableCell className="text-right tabular-nums">{category.transactionCount}</TableCell>
            <TableCell className="pr-6">
              <div className="flex justify-end gap-1">
                <CategoryDialog
                  category={category}
                  trigger={
                    <Button variant="ghost" size="icon" aria-label={`Modifier ${category.name}`}>
                      <Pencil />
                    </Button>
                  }
                />
                <DeleteCategoryButton category={category} />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function detachWarning(count: number): string {
  if (count === 0) return "Aucune transaction n'utilise cette catégorie."
  if (count === 1) return "1 transaction sera détachée et redeviendra non catégorisée."
  return `${count} transactions seront détachées et redeviendront non catégorisées.`
}

function DeleteCategoryButton({ category }: { category: Category }) {
  const queryClient = useQueryClient()
  const remove = useMutation({
    mutationFn: () => api.categories.remove(category.id),
    onSuccess: async () => {
      await Promise.all([
        invalidateTransactionData(queryClient),
        queryClient.invalidateQueries({ queryKey: rulesQuery.queryKey }),
      ])
      toast.success(`Catégorie « ${category.name} » supprimée`)
    },
    onError: (error) => toast.error(error.message),
  })

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Supprimer ${category.name}`}>
          <Trash2 />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer la catégorie « {category.name} » ?</AlertDialogTitle>
          <AlertDialogDescription>
            {detachWarning(category.transactionCount)} Les règles et sous-catégories qui la référencent seront aussi détachées.
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
