import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ChevronRight, MoreHorizontal, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react"
import { useState } from "react"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ApplyRulesButton, ApplyRulesDialog } from "@/components/rules/apply-rules-button"
import { RuleList } from "@/components/rules/category-rules"
import { useIsMobile } from "@/hooks/use-mobile"
import { api, type Category, type Rule, type Theme } from "@/lib/api"
import i18n from "@/i18n"
import { type CategoryGroup, groupCategoriesByTheme } from "@/lib/category-groups"
import { categoriesQuery, invalidateTransactionData, rulesQuery, themesQuery } from "@/lib/queries"
import { cn } from "@/lib/utils"
import { CategoryDialog } from "./category-dialog"
import { ColorDot } from "./color-dot"
import { ThemeDialog } from "./theme-dialog"
import { useTranslation } from "react-i18next"

export function CategoriesPanel() {
  const { t } = useTranslation()
  const { data: categories, isPending, error } = useQuery(categoriesQuery)
  const { data: themes } = useQuery(themesQuery)
  const { data: rules = [] } = useQuery(rulesQuery)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {t("categories.intro")}
        </p>
        <CategoriesActions />
      </div>
      <Card className="py-0">
        <CardContent className="px-0">
          {(isPending || !themes) && !error && <Skeleton className="m-6 h-5" />}
          {error && <p className="p-6 text-sm text-destructive">{error.message}</p>}
          {categories && themes && <CategoriesTable categories={categories} themes={themes} rules={rules} />}
        </CardContent>
      </Card>
      {categories && <OtherRules rules={rules} categories={categories} />}
    </div>
  )
}

function NewCategoryButton({ className }: { className?: string }) {
  const { t } = useTranslation()
  return (
    <CategoryDialog
      trigger={
        <Button className={className}>
          <Plus />
          {t("categories.newCategory")}
        </Button>
      }
    />
  )
}

function CategoriesActions() {
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  if (isMobile) return <MobileCategoriesActions />

  return (
    <div className="flex flex-wrap gap-2">
      <ApplyRulesButton />
      <ThemeDialog
        trigger={
          <Button variant="outline">
            <Plus />
            {t("categories.newTheme")}
          </Button>
        }
      />
      <NewCategoryButton />
    </div>
  )
}

function MobileCategoriesActions() {
  const { t } = useTranslation()
  const [applyOpen, setApplyOpen] = useState(false)
  const [themeOpen, setThemeOpen] = useState(false)

  return (
    <div className="flex w-full gap-2">
      <NewCategoryButton className="flex-1" />
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label={t("categories.moreActions")}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setApplyOpen(true)}>
            <RefreshCw />
            {t("rules.apply.button")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setThemeOpen(true)}>
            <Plus />
            {t("categories.newTheme")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ApplyRulesDialog open={applyOpen} onOpenChange={setApplyOpen} />
      {themeOpen && <ThemeDialog open onOpenChange={setThemeOpen} />}
    </div>
  )
}

function groupRulesByCategory(rules: Rule[]): Map<string, Rule[]> {
  const byCategory = new Map<string, Rule[]>()
  for (const rule of rules) {
    if (!rule.categoryId) continue
    byCategory.set(rule.categoryId, [...(byCategory.get(rule.categoryId) ?? []), rule])
  }
  return byCategory
}

function OtherRules({ rules, categories }: { rules: Rule[]; categories: Category[] }) {
  const { t } = useTranslation()
  const otherRules = rules.filter((rule) => !rule.categoryId)
  if (otherRules.length === 0) return null
  const categoriesById = new Map(categories.map((category) => [category.id, category]))
  return (
    <Card className="py-0">
      <CardContent className="space-y-2 p-6">
        <h3 className="font-semibold">{t("categories.otherRules.title")}</h3>
        <p className="text-sm text-muted-foreground">{t("categories.otherRules.description")}</p>
        <RuleList rules={otherRules} categoriesById={categoriesById} />
      </CardContent>
    </Card>
  )
}

function CategoriesTable({
  categories,
  themes,
  rules,
}: {
  categories: Category[]
  themes: Theme[]
  rules: Rule[]
}) {
  const { t } = useTranslation()
  const groups = groupCategoriesByTheme(categories, themes)
  const rulesByCategory = groupRulesByCategory(rules)
  const categoriesById = new Map(categories.map((category) => [category.id, category]))
  const emptyThemes = themes.filter((theme) => !groups.some((group) => group.theme?.id === theme.id))
  if (groups.length === 0 && emptyThemes.length === 0) {
    return <p className="p-6 text-center text-sm text-muted-foreground">{t("categories.empty")}</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-4 sm:pl-6">{t("categories.columns.name")}</TableHead>
          <TableHead className="text-right">{t("categories.columns.transactions")}</TableHead>
          <TableHead className="pr-6 text-right">{t("categories.columns.actions")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[...groups, ...emptyThemes.map((theme) => ({ theme, categories: [] }))].map((group) => (
          <CategoryGroupRows
            key={group.theme?.id ?? "none"}
            group={group}
            rulesByCategory={rulesByCategory}
            categoriesById={categoriesById}
          />
        ))}
      </TableBody>
    </Table>
  )
}

type CategoryGroupRowsProps = {
  group: CategoryGroup
  rulesByCategory: Map<string, Rule[]>
  categoriesById: Map<string, Category>
}

function CategoryGroupRows({ group, rulesByCategory, categoriesById }: CategoryGroupRowsProps) {
  const { t } = useTranslation()
  return (
    <>
      <TableRow className="bg-muted/40 hover:bg-muted/40">
        <TableCell className="w-full max-w-0 pl-4 font-semibold sm:pl-6">
          <span className="flex items-center gap-2">
            {group.theme && <ColorDot color={group.theme.color} className="size-3 shrink-0" />}
            <span className="truncate">{group.theme?.name ?? t("categories.noTheme")}</span>
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
                  <Button variant="ghost" size="icon" aria-label={t("categories.editTheme", { name: group.theme.name })}>
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
        <CategoryRows
          key={category.id}
          category={category}
          rules={rulesByCategory.get(category.id) ?? []}
          categoriesById={categoriesById}
        />
      ))}
    </>
  )
}

function CategoryRows({
  category,
  rules,
  categoriesById,
}: {
  category: Category
  rules: Rule[]
  categoriesById: Map<string, Category>
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  return (
    <>
        <TableRow>
          <TableCell className="w-full max-w-0 pl-4 font-medium sm:pl-8">
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpen(!open)}
              className="flex min-h-11 w-full items-center gap-2 rounded-sm text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <ChevronRight className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} />
              <ColorDot color={category.color} className="size-3 shrink-0" />
              <span className="min-w-0">
                <span className="block truncate">{category.name}</span>
                {rules.length > 0 && (
                  <span className="block text-xs font-normal text-muted-foreground">
                    {t("categories.ruleCount", { count: rules.length })}
                  </span>
                )}
              </span>
            </button>
          </TableCell>
          <TableCell className="text-right tabular-nums">{category.transactionCount}</TableCell>
          <TableCell className="pr-6">
            <div className="flex justify-end gap-1">
              <CategoryDialog
                category={category}
                trigger={
                  <Button variant="ghost" size="icon" aria-label={t("categories.edit", { name: category.name })}>
                    <Pencil />
                  </Button>
                }
              />
              <DeleteCategoryButton category={category} />
            </div>
          </TableCell>
        </TableRow>
        {open && (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={3} className="pr-4 pl-4 whitespace-normal sm:pr-6 sm:pl-14">
              <RuleList rules={rules} categoriesById={categoriesById} categoryId={category.id} />
            </TableCell>
          </TableRow>
        )}
    </>
  )
}

function DeleteThemeButton({ theme }: { theme: Theme }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const remove = useMutation({
    mutationFn: () => api.themes.remove(theme.id),
    onSuccess: async () => {
      await invalidateTransactionData(queryClient)
      toast.success(t("categories.themeDeleted", { name: theme.name }))
    },
    onError: (error) => toast.error(error.message),
  })

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("categories.deleteTheme", { name: theme.name })}>
          <Trash2 />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("categories.deleteThemeTitle", { name: theme.name })}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("categories.deleteThemeDescription", { count: theme.categoryCount })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={() => remove.mutate()}>{t("categories.confirmDelete")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function detachWarning(count: number): string {
  if (count === 0) return i18n.t("categories.detachNone")
  return i18n.t("categories.detachWarning", { count })
}

function DeleteCategoryButton({ category }: { category: Category }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const remove = useMutation({
    mutationFn: () => api.categories.remove(category.id),
    onSuccess: async () => {
      await Promise.all([
        invalidateTransactionData(queryClient),
        queryClient.invalidateQueries({ queryKey: rulesQuery.queryKey }),
      ])
      toast.success(t("categories.categoryDeleted", { name: category.name }))
    },
    onError: (error) => toast.error(error.message),
  })

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("categories.delete", { name: category.name })}>
          <Trash2 />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("categories.deleteCategoryTitle", { name: category.name })}</AlertDialogTitle>
          <AlertDialogDescription>
            {detachWarning(category.transactionCount)} {t("categories.deleteCategoryRules")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={() => remove.mutate()}>{t("categories.confirmDelete")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
