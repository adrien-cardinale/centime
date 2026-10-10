import { getVault } from "@/lib/crypto/current-vault"
import { getLocalDatabase } from "@/lib/local-db/current-database"
import { deleteServerAccount, getSyncState, syncNow } from "@/lib/sync/sync-store"
import { removeAccount, setActiveAccount } from "./accounts"

async function removeActiveAccount(): Promise<void> {
  await getLocalDatabase().erase()
  await removeAccount(getVault().credentials.userId)
  window.location.reload()
}

export async function leaveDevice(): Promise<void> {
  if (getSyncState().configured) {
    const outcome = await syncNow()
    if (!outcome.ok) throw new Error(outcome.message)
  }
  await removeActiveAccount()
}

export async function deleteAccountEverywhere(): Promise<void> {
  await deleteServerAccount()
  await removeActiveAccount()
}

export async function switchAccount(id: string): Promise<void> {
  await getLocalDatabase().flush()
  await setActiveAccount(id)
  window.location.reload()
}
