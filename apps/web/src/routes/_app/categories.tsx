import { createFileRoute } from "@tanstack/react-router"
import { CategoriesPanel } from "@/components/categories/categories-panel"
import { PageHeader } from "@/components/page-header"
import { categoriesQuery, rulesQuery, themesQuery } from "@/lib/queries"
import { useTranslation } from "react-i18next"

export const Route = createFileRoute("/_app/categories")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.prefetchQuery(categoriesQuery),
      context.queryClient.prefetchQuery(themesQuery),
      context.queryClient.prefetchQuery(rulesQuery),
    ]),
  component: CategoriesPage,
})

function CategoriesPage() {
  const { t } = useTranslation()
  return (
    <div className="space-y-6">
      <PageHeader title={t("categoriesPage.title")} description={t("categoriesPage.description")} />
      <CategoriesPanel />
    </div>
  )
}
