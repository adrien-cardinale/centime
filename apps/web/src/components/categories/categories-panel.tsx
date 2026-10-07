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
import { api, type Category, type Theme } from "@/lib/api"
import { type CategoryGroup, groupCategoriesByTheme } from "@/lib/category-groups"
import { categoriesQuery, invalidateTransactionData, rulesQuery, themesQuery } from "@/lib/queries"
import { CategoryDialog } from "./category-dialog"
import { ColorDot } from "./color-dot"
import { ThemeDialog } from "./theme-dialog"

export function CategoriesPanel() {
  const { data: categories, isPending, error } = useQuery(categoriesQuery)
  const { data: themes } = useQuery(themesQuery)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Les transactions se classent dans des catégories, que vous pouvez regrouper sous des thèmes.
        </p>
        <div className="flex gap-2">
          <ThemeDialog
            trigger={
              <Button variant="outline">
                <Plus />
                Nouveau thème
              </Button>
            }
          />
          <CategoryDialog
            trigger={
              <Button>
                <Plus />
                Nouvelle catégorie
              </Button>
            }
          />
        </div>
      </div>
      <Card className="py-0">
        <CardContent className="px-0">
          {(isPending || !themes) && !error && <Skeleton className="m-6 h-5" />}
          {error && <p className="p-6 text-sm text-destructive">{error.message}</p>}
          {categories && themes && <CategoriesTable categories={categories} themes={themes} />}
        </CardContent>
      </Card>
    </div>
  )
}

function CategoriesTable({ categories, themes }: { categories: Category[]; themes: Theme[] }) {
  const groups = groupCategoriesByTheme(categories, themes)
  const emptyThemes = themes.filter((theme) => !groups.some((group) => group.theme?.id === theme.id))
  if (groups.length === 0 && emptyThemes.length === 0) {
    return <p className="p-6 text-center text-sm text-muted-foreground">Aucune catégorie.</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-6">Nom</TableHead>
          <TableHead className="text-right">Transactions</TableHead>
          <TableHead className="pr-6 text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[...groups, ...emptyThemes.map((theme) => ({ theme, categories: [] }))].map((group) => (
          <CategoryGroupRows key={group.theme?.id ?? "none"} group={group} />
        ))}
      </TableBody>
    </Table>
  )
}

function CategoryGroupRows({ group }: { group: CategoryGroup }) {
  return (
    <>
      <TableRow className="bg-muted/40 hover:bg-muted/40">
        <TableCell className="pl-6 font-semibold">
          <span className="flex items-center gap-2">
            {group.theme && <ColorDot color={group.theme.color} className="size-3" />}
            {group.theme?.name ?? "Sans thème"}
          </span>
        </TableCell>
        <TableCell className="text-right text-muted-foreground tabular-nums">
          {group.categories.reduce((total, category) => total + category.transactionCount, 0)}
        </TableCell>
        <TableCell className="pr-6">
          {group.theme && (
            <div className="flex justify-end gap-1">
              <ThemeDialog
                theme={group.theme}
                trigger={
                  <Button variant="ghost" size="icon" aria-label={`Modifier le thème ${group.theme.name}`}>
                    <Pencil />
                  </Button>
                }
              />
              <DeleteThemeButton theme={group.theme} />
            </div>
          )}
        </TableCell>
      </TableRow>
      {group.categories.map((category) => (
        <TableRow key={category.id}>
          <TableCell className="pl-12 font-medium">
            <span className="flex items-center gap-2">
              <ColorDot color={category.color} className="size-3" />
              {category.name}
            </span>
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
    </>
  )
}

function DeleteThemeButton({ theme }: { theme: Theme }) {
  const queryClient = useQueryClient()
  const remove = useMutation({
    mutationFn: () => api.themes.remove(theme.id),
    onSuccess: async () => {
      await invalidateTransactionData(queryClient)
      toast.success(`Thème « ${theme.name} » supprimé`)
    },
    onError: (error) => toast.error(error.message),
  })

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Supprimer le thème ${theme.name}`}>
          <Trash2 />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer le thème « {theme.name} » ?</AlertDialogTitle>
          <AlertDialogDescription>
            Ses {theme.categoryCount} catégories et leurs transactions sont conservées, mais n'auront plus de thème.
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
            {detachWarning(category.transactionCount)} Les règles qui la référencent seront aussi détachées.
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
