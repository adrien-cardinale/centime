import { RefreshCw, TriangleAlert, Unplug } from "lucide-react"
import { useState } from "react"
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
  return `Synchronisation terminée : ${pulled} reçue(s), ${pushed} envoyée(s)`
}

export function SyncStatusCard({ state }: { state: SyncState }) {
  const syncing = state.status === "syncing"

  const synchronizeNow = async () => {
    const outcome = await syncNow()
    if (outcome.ok) toast.success(describeReport(outcome.report.pulled, outcome.report.pushed))
    else toast.error(outcome.message)
  }

  return (
    <div className="space-y-4">
      <dl className="space-y-2">
        <SyncDetail label="Serveur" value={state.serverUrl ?? ""} />
        <SyncDetail label="Dernière synchronisation" value={state.lastAt ? formatDateTime(state.lastAt) : "Jamais"} />
        <SyncDetail label="Modifications locales" value={formatPendingChanges(state.dirtyCount)} />
      </dl>
      {state.lastError && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Dernière synchronisation en échec</AlertTitle>
          <AlertDescription>{state.lastError}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void synchronizeNow()} disabled={syncing}>
          <RefreshCw className={syncing ? "animate-spin" : undefined} />
          {syncing ? "Synchronisation…" : "Synchroniser maintenant"}
        </Button>
        <DisconnectButton />
      </div>
    </div>
  )
}

function DisconnectButton() {
  const [pending, setPending] = useState(false)

  const confirm = async () => {
    setPending(true)
    try {
      await disconnect()
      toast.success("Appareil déconnecté du serveur")
    } finally {
      setPending(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" disabled={pending}>
          <Unplug />
          Déconnecter
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Déconnecter cet appareil ?</AlertDialogTitle>
          <AlertDialogDescription>
            La synchronisation s'arrête. Les données locales sont conservées sur cet ordinateur.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={() => void confirm()}>Déconnecter</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
