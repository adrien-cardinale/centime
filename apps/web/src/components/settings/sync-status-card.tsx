import { RefreshCw, TriangleAlert, Unplug } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import i18n from "@/i18n"
import { formatDateTime } from "@/lib/format"
import { formatPendingChanges } from "@/lib/sync/sync-labels"
import { disconnect, type SyncState, syncNow } from "@/lib/sync/sync-store"

function SyncDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[12rem_1fr]">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm break-all">{value}</dd>
    </div>
  )
}

function describeReport(pulled: number, pushed: number): string {
  return i18n.t("settings.sync.report", { pulled, pushed })
}

export function SyncStatusCard({ state }: { state: SyncState }) {
  const { t } = useTranslation()
  const syncing = state.status === "syncing"

  const synchronizeNow = async () => {
    const outcome = await syncNow()
    if (outcome.ok) toast.success(describeReport(outcome.report.pulled, outcome.report.pushed))
    else toast.error(outcome.message)
  }

  return (
    <div className="space-y-4">
      <dl className="space-y-2">
        <SyncDetail label={t("settings.sync.server")} value={state.serverUrl ?? ""} />
        <SyncDetail label={t("settings.sync.lastSync")} value={state.lastAt ? formatDateTime(state.lastAt) : t("common.never")} />
        <SyncDetail label={t("settings.sync.localChanges")} value={formatPendingChanges(state.dirtyCount)} />
      </dl>
      {state.lastError && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>{t("settings.sync.lastSyncFailed")}</AlertTitle>
          <AlertDescription>{state.lastError}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void synchronizeNow()} disabled={syncing}>
          <RefreshCw className={syncing ? "animate-spin" : undefined} />
          {syncing ? t("settings.sync.syncing") : t("settings.sync.syncNow")}
        </Button>
        <DisconnectButton />
      </div>
    </div>
  )
}

function DisconnectButton() {
  const { t } = useTranslation()
  const [pending, setPending] = useState(false)

  const confirm = async () => {
    setPending(true)
    try {
      await disconnect()
      toast.success(t("settings.sync.disconnected"))
    } finally {
      setPending(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" disabled={pending}>
          <Unplug />
          {t("settings.sync.disconnect")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("settings.sync.disconnectTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("settings.sync.disconnectDescription")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={() => void confirm()}>{t("settings.sync.disconnect")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
