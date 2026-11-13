import { createFileRoute } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { PageHeader } from "@/components/page-header"
import { AiExtractionCard } from "@/components/settings/ai-extraction-card"
import { AutoRulesCard } from "@/components/settings/auto-rules-card"
import { BaseCurrencyCard } from "@/components/settings/base-currency-card"
import { LanguageCard } from "@/components/settings/language-card"
import SyncPanel from "@/components/settings/sync-panel"
import { UpdateCard } from "@/components/settings/update-card"

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
      <BaseCurrencyCard />
      <AutoRulesCard />
      <AiExtractionCard />
      <UpdateCard />
    </div>
  )
}
