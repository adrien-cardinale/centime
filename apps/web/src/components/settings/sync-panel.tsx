import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useSyncStore } from "@/lib/sync/sync-store"
import { LocalDataCard } from "./local-data-card"
import { SyncConnectForm } from "./sync-connect-form"
import { SyncStatusCard } from "./sync-status-card"

export default function SyncPanel() {
  const state = useSyncStore()

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Serveur de synchronisation</CardTitle>
          <CardDescription>
            {state.configured
              ? "Les modifications sont échangées avec le serveur toutes les 5 minutes et après chaque changement."
              : "Connectez cet ordinateur à votre serveur centime pour retrouver vos données partout."}
          </CardDescription>
        </CardHeader>
        <CardContent>{state.configured ? <SyncStatusCard state={state} /> : <SyncConnectForm />}</CardContent>
      </Card>
      <LocalDataCard neverSynced={state.lastAt === null} />
    </div>
  )
}
