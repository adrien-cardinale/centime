import { createFileRoute } from "@tanstack/react-router"
import { PageHeader } from "@/components/page-header"
import SyncPanel from "@/components/settings/sync-panel"

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
})

function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Paramètres" />
      <SyncPanel />
    </div>
  )
}
