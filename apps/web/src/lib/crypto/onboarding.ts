import { nextDefaultLabel } from "@/lib/account/account-index"
import {
  addAccount,
  getActiveAccount,
  readAccountIndex,
  setActiveAccount,
  storePendingServerUrl,
} from "@/lib/account/accounts"
import { defaultAccountLabel } from "@/lib/account/legacy-migration"
import { createKeyStore } from "@/lib/local-db/key-store"
import { setVault } from "./current-vault"
import { deriveVault, type Vault } from "./envelope"

export class KeyRequiredError extends Error {
  constructor() {
    super("Aucune clé de chiffrement sur cet appareil")
  }
}

export async function loadVault(): Promise<Vault> {
  const account = await getActiveAccount()
  if (account === null) throw new KeyRequiredError()
  const key = await (await createKeyStore(account.id)).load()
  if (key === null) throw new KeyRequiredError()
  const vault = await deriveVault(key)
  setVault(vault)
  return vault
}

async function registerAccount(id: string, serverUrl: string | null): Promise<void> {
  const index = await readAccountIndex()
  if (index.accounts.some((account) => account.id === id)) {
    if (serverUrl !== null) await storePendingServerUrl(id, serverUrl)
    return
  }
  await addAccount({ id, label: nextDefaultLabel(index, defaultAccountLabel), pendingServerUrl: serverUrl })
}

export async function completeOnboarding(key: Uint8Array, serverUrl: string | null): Promise<void> {
  const { userId } = (await deriveVault(key)).credentials
  await (await createKeyStore(userId)).save(key)
  await registerAccount(userId, serverUrl)
  await setActiveAccount(userId)
}
