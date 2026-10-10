import { getLocalDatabase } from "@/lib/local-db/current-database"
import { createKeyStore } from "@/lib/local-db/key-store"
import { deleteServerAccount, getSyncState, syncNow } from "@/lib/sync/sync-store"

async function wipeDevice(): Promise<void> {
  await getLocalDatabase().erase()
  await (await createKeyStore()).clear()
  window.location.reload()
}

export async function leaveDevice(): Promise<void> {
  if (getSyncState().configured) {
    const outcome = await syncNow()
    if (!outcome.ok) throw new Error(outcome.message)
  }
  await wipeDevice()
}

export async function deleteAccountEverywhere(): Promise<void> {
  await deleteServerAccount()
  await wipeDevice()
}
