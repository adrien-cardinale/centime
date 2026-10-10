import { useRef } from "react"
import { useTranslation } from "react-i18next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useSyncStore } from "@/lib/sync/sync-store"
import { AccountCard } from "./account-card"
import { LocalDataCard } from "./local-data-card"
import { RecoveryKeyCard } from "./recovery-key-card"
import { SyncConnectForm } from "./sync-connect-form"
import { SyncStatusCard } from "./sync-status-card"

export default function SyncPanel() {
  const state = useSyncStore()
  const { t } = useTranslation()
  const syncCardRef = useRef<HTMLDivElement>(null)
  const scrollToSync = () => syncCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })

  return (
    <div className="space-y-4">
      <Card ref={syncCardRef} className="scroll-mt-4">
        <CardHeader>
          <CardTitle>{t("settings.sync.title")}</CardTitle>
          <CardDescription>
            {state.configured
              ? t("settings.sync.configuredDescription")
              : t("settings.sync.unconfiguredDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>{state.configured ? <SyncStatusCard state={state} /> : <SyncConnectForm />}</CardContent>
      </Card>
      <RecoveryKeyCard serverUrl={state.serverUrl} />
      <LocalDataCard onConfigureSync={state.configured ? undefined : scrollToSync} />
      <AccountCard syncConfigured={state.configured} />
    </div>
  )
}
