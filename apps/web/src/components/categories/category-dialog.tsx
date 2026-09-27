import { type CategoryInput, categoryInputSchema } from "@centime/core"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { type ReactNode, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import type { z } from "zod"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { api, type Category } from "@/lib/api"
import { DEFAULT_CATEGORY_COLOR } from "@/lib/category-colors"
import { invalidateTransactionData } from "@/lib/queries"
import { CategorySelect } from "./category-select"
import { ColorPicker } from "./color-picker"

type CategoryFormValues = z.input<typeof categoryInputSchema>

const NO_PARENT = "none"

type CategoryDialogProps = {
  category?: Category
  trigger: ReactNode
}

function formValuesFor(category: Category | undefined): CategoryFormValues {
  if (!category) return { name: "", color: DEFAULT_CATEGORY_COLOR, parentId: null }
  return { name: category.name, color: category.color, icon: category.icon, parentId: category.parentId }
}

function saveCategory(category: Category | undefined, input: CategoryInput) {
  return category ? api.categories.update(category.id, input) : api.categories.create(input)
}

export function CategoryDialog({ category, trigger }: CategoryDialogProps) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const form = useForm<CategoryFormValues, unknown, CategoryInput>({
    resolver: zodResolver(categoryInputSchema),
    defaultValues: formValuesFor(category),
  })

  const save = useMutation({
    mutationFn: (input: CategoryInput) => saveCategory(category, input),
    onSuccess: async (saved) => {
      await invalidateTransactionData(queryClient)
      toast.success(`Catégorie « ${saved.name} » enregistrée`)
      setOpen(false)
    },
    onError: (error) => toast.error(error.message),
  })

  const changeOpen = (next: boolean) => {
    if (next) form.reset(formValuesFor(category))
    setOpen(next)
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{category ? "Modifier la catégorie" : "Nouvelle catégorie"}</DialogTitle>
          <DialogDescription>Nom, couleur et catégorie parente éventuelle.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((input) => save.mutate(input))} className="space-y-5">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom</FormLabel>
                  <FormControl>
                    <Input placeholder="Alimentation" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Couleur</FormLabel>
                  <ColorPicker value={field.value} onChange={field.onChange} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="parentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Catégorie parente</FormLabel>
                  <FormControl>
                    <CategorySelect
                      value={field.value ?? NO_PARENT}
                      onChange={(value) => field.onChange(value === NO_PARENT ? null : value)}
                      extraOptions={[{ value: NO_PARENT, label: "Aucune" }]}
                      excludeId={category?.id}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
