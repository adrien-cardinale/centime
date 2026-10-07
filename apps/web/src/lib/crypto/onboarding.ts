import { createKeyStore } from "@/lib/local-db/key-store"
import { setVault } from "./current-vault"
import { deriveVault, type Vault } from "./envelope"

export class KeyRequiredError extends Error {
  constructor() {
    super("Aucune clé de chiffrement sur cet appareil")
  }
}

let pendingServerUrl: string | null = null

export async function loadVault(): Promise<Vault> {
  const key = await (await createKeyStore()).load()
  if (key === null) throw new KeyRequiredError()
  const vault = await deriveVault(key)
  setVault(vault)
  return vault
}

export async function completeOnboarding(key: Uint8Array, serverUrl: string | null): Promise<void> {
  await (await createKeyStore()).save(key)
  pendingServerUrl = serverUrl
}

export function takePendingServerUrl(): string | null {
  const url = pendingServerUrl
  pendingServerUrl = null
  return url
}
