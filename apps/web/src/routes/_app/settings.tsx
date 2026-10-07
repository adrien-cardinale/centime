import { createFileRoute } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { PageHeader } from "@/components/page-header"
import { LanguageCard } from "@/components/settings/language-card"
import SyncPanel from "@/components/settings/sync-panel"

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
})

function SettingsPage() {
  const { t } = useTranslation()
  return (
    <div className="space-y-6">
      <PageHeader title={t("settings.title")} />
      <LanguageCard />
      <SyncPanel />
    </div>
  )
}
