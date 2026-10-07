import { type ThemeInput, themeInputSchema } from "@centime/core"
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
import { api, type Theme } from "@/lib/api"
import { DEFAULT_CATEGORY_COLOR } from "@/lib/category-colors"
import { invalidateTransactionData } from "@/lib/queries"
import { ColorPicker } from "./color-picker"
import { useTranslation } from "react-i18next"

type ThemeFormValues = z.input<typeof themeInputSchema>

type ThemeDialogProps = {
  theme?: Theme
  trigger: ReactNode
}

function formValuesFor(theme: Theme | undefined): ThemeFormValues {
  if (!theme) return { name: "", color: DEFAULT_CATEGORY_COLOR }
  return { name: theme.name, color: theme.color, icon: theme.icon }
}

function saveTheme(theme: Theme | undefined, input: ThemeInput) {
  return theme ? api.themes.update(theme.id, input) : api.themes.create(input)
}

export function ThemeDialog({ theme, trigger }: ThemeDialogProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const form = useForm<ThemeFormValues, unknown, ThemeInput>({
    resolver: zodResolver(themeInputSchema),
    defaultValues: formValuesFor(theme),
  })

  const save = useMutation({
    mutationFn: (input: ThemeInput) => saveTheme(theme, input),
    onSuccess: async (saved) => {
      await invalidateTransactionData(queryClient)
      toast.success(t("categories.themeDialog.saved", { name: saved.name }))
      setOpen(false)
    },
    onError: (error) => toast.error(error.message),
  })

  const changeOpen = (next: boolean) => {
    if (next) form.reset(formValuesFor(theme))
    setOpen(next)
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{theme ? t("categories.themeDialog.editTitle") : t("categories.newTheme")}</DialogTitle>
          <DialogDescription>
            {t("categories.themeDialog.description")}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((input) => save.mutate(input))} className="space-y-5">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("categories.form.name")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("categories.themeDialog.namePlaceholder")} {...field} />
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
                  <FormLabel>{t("categories.form.color")}</FormLabel>
                  <ColorPicker value={field.value} onChange={field.onChange} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? t("categories.form.saving") : t("categories.form.save")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
