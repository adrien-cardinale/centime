import { createFileRoute } from "@tanstack/react-router"
import { lazy, Suspense } from "react"
import { PageHeader } from "@/components/page-header"
import { ApiTokensPanel } from "@/components/settings/api-tokens-panel"
import { CsvProfilesPanel } from "@/components/settings/csv-profiles-panel"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { csvProfilesQuery } from "@/lib/queries"
import { isDesktop } from "@/lib/runtime"

const SyncPanel = __CENTIME_DESKTOP__ ? lazy(() => import("@/components/settings/sync-panel")) : null

export const Route = createFileRoute("/_app/settings")({
  loader: ({ context }) => context.queryClient.prefetchQuery(csvProfilesQuery),
  component: SettingsPage,
})

function DesktopSyncTab() {
  if (!SyncPanel) return null
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full" />}>
      <SyncPanel />
    </Suspense>
  )
}

function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Paramètres" />
      <Tabs defaultValue="csv-profiles">
        <TabsList>
          <TabsTrigger value="csv-profiles">Fournisseurs CSV</TabsTrigger>
          {isDesktop ? (
            <TabsTrigger value="sync">Synchronisation</TabsTrigger>
          ) : (
            <TabsTrigger value="api-tokens">Jetons d'API</TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="csv-profiles" className="pt-4">
          <CsvProfilesPanel />
        </TabsContent>
        {isDesktop ? (
          <TabsContent value="sync" className="pt-4">
            <DesktopSyncTab />
          </TabsContent>
        ) : (
          <TabsContent value="api-tokens" className="pt-4">
            <ApiTokensPanel />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
