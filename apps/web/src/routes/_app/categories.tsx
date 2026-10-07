import { createFileRoute } from "@tanstack/react-router"
import { CategoriesPanel } from "@/components/categories/categories-panel"
import { PageHeader } from "@/components/page-header"
import { categoriesQuery, rulesQuery, themesQuery } from "@/lib/queries"

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
  return (
    <div className="space-y-6">
      <PageHeader title="Catégories" description="Organisez vos transactions et automatisez leur classement." />
      <CategoriesPanel />
    </div>
  )
}
