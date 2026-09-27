import { createFileRoute } from "@tanstack/react-router"
import { PageHeader } from "@/components/page-header"
import { CsvProfilesPanel } from "@/components/settings/csv-profiles-panel"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { csvProfilesQuery } from "@/lib/queries"

export const Route = createFileRoute("/_app/settings")({
  loader: ({ context }) => context.queryClient.prefetchQuery(csvProfilesQuery),
  component: SettingsPage,
})

function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Paramètres" />
      <Tabs defaultValue="csv-profiles">
        <TabsList>
          <TabsTrigger value="csv-profiles">Fournisseurs CSV</TabsTrigger>
        </TabsList>
        <TabsContent value="csv-profiles" className="pt-4">
          <CsvProfilesPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}
