import { type CategoryInput, categoryInputSchema } from "@centime/core"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { type FormEvent, type ReactNode, useState } from "react"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { api, type Category } from "@/lib/api"
import { DEFAULT_CATEGORY_COLOR } from "@/lib/category-colors"
import { invalidateTransactionData, themesQuery } from "@/lib/queries"
import { ColorDot } from "./color-dot"
import { ColorPicker } from "./color-picker"

type CategoryFormValues = z.input<typeof categoryInputSchema>

const NO_THEME = "none"

type CategoryDialogProps = {
  category?: Category
  trigger?: ReactNode
  initialName?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onSaved?: (categoryId: string) => void
}

function formValuesFor(category: Category | undefined, initialName = ""): CategoryFormValues {
  if (!category) return { name: initialName, color: DEFAULT_CATEGORY_COLOR, themeId: null }
  return { name: category.name, color: category.color, icon: category.icon, themeId: category.themeId }
}

function saveCategory(category: Category | undefined, input: CategoryInput) {
  return category ? api.categories.update(category.id, input) : api.categories.create(input)
}

export function CategoryDialog({ category, trigger, initialName, open, onOpenChange, onSaved }: CategoryDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const setOpen = onOpenChange ?? setInternalOpen
  const queryClient = useQueryClient()
  const { data: themes = [] } = useQuery(themesQuery)
  const form = useForm<CategoryFormValues, unknown, CategoryInput>({
    resolver: zodResolver(categoryInputSchema),
    defaultValues: formValuesFor(category, initialName),
  })

  const save = useMutation({
    mutationFn: (input: CategoryInput) => saveCategory(category, input),
    onSuccess: async (saved) => {
      await invalidateTransactionData(queryClient)
      toast.success(`Catégorie « ${saved.name} » enregistrée`)
      setOpen(false)
      onSaved?.(saved.id)
    },
    onError: (error) => toast.error(error.message),
  })

  const changeOpen = (next: boolean) => {
    if (next) form.reset(formValuesFor(category, initialName))
    setOpen(next)
  }

  // Ouverte depuis un autre formulaire, la soumission ne doit pas remonter jusqu'à lui.
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.stopPropagation()
    void form.handleSubmit((input) => save.mutate(input))(event)
  }

  return (
    <Dialog open={open ?? internalOpen} onOpenChange={changeOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{category ? "Modifier la catégorie" : "Nouvelle catégorie"}</DialogTitle>
          <DialogDescription>Nom, couleur et thème éventuel.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={submit} className="space-y-5">
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
              name="themeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Thème</FormLabel>
                  <Select
                    value={field.value ?? NO_THEME}
                    onValueChange={(value) => field.onChange(value === NO_THEME ? null : value)}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_THEME}>Aucun thème</SelectItem>
                      {themes.map((theme) => (
                        <SelectItem key={theme.id} value={theme.id}>
                          <ColorDot color={theme.color} />
                          {theme.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
