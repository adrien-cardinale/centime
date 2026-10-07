import { createFileRoute } from "@tanstack/react-router"
import { CategoriesPanel } from "@/components/categories/categories-panel"
import { PageHeader } from "@/components/page-header"
import { RulesPanel } from "@/components/rules/rules-panel"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
      <Tabs defaultValue="categories">
        <TabsList>
          <TabsTrigger value="categories">Catégories</TabsTrigger>
          <TabsTrigger value="rules">Règles</TabsTrigger>
        </TabsList>
        <TabsContent value="categories" className="pt-4">
          <CategoriesPanel />
        </TabsContent>
        <TabsContent value="rules" className="pt-4">
          <RulesPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}
