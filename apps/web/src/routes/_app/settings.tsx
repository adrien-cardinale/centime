import { createFileRoute } from "@tanstack/react-router"
import { lazy, Suspense } from "react"
import { PageHeader } from "@/components/page-header"
import { ApiTokensPanel } from "@/components/settings/api-tokens-panel"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { isDesktop } from "@/lib/runtime"

const SyncPanel = __CENTIME_DESKTOP__ ? lazy(() => import("@/components/settings/sync-panel")) : null

export const Route = createFileRoute("/_app/settings")({
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
      <Tabs defaultValue={isDesktop ? "sync" : "api-tokens"}>
        <TabsList>
          {isDesktop ? (
            <TabsTrigger value="sync">Synchronisation</TabsTrigger>
          ) : (
            <TabsTrigger value="api-tokens">Jetons d'API</TabsTrigger>
          )}
        </TabsList>
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
