import i18n from "@/i18n"
import { deriveVault } from "@/lib/crypto/envelope"
import { createKeyStore, createLegacyKeyStore } from "@/lib/local-db/key-store"
import { createDatabaseStore, createLegacyDatabaseStore } from "@/lib/local-db/persistence"
import {
  type AccountIndex,
  EMPTY_ACCOUNT_INDEX,
  nextDefaultLabel,
  withAccount,
  withActiveIfNone,
} from "./account-index"
import { loadStoredIndex, saveStoredIndex } from "./index-storage"

export function defaultAccountLabel(n: number): string {
  return i18n.t("settings.account.defaultLabel", { n })
}

async function moveLegacyDatabase(id: string): Promise<void> {
  const legacy = await createLegacyDatabaseStore()
  const bytes = await legacy.load()
  if (bytes === null) return
  const target = await createDatabaseStore(id)
  if ((await target.load()) === null) await target.save(bytes)
  await legacy.remove()
}

function withLegacyAccount(index: AccountIndex, id: string): AccountIndex {
  const account = { id, label: nextDefaultLabel(index, defaultAccountLabel), createdAt: new Date().toISOString() }
  return withActiveIfNone(withAccount(index, account), id)
}

/** Les fichiers d'une version mono-compte sont recopiés avant d'être effacés : une interruption laisse toujours une copie lisible. */
export async function migrateLegacyAccount(): Promise<void> {
  const stored = await loadStoredIndex()
  const legacyKeys = await createLegacyKeyStore()
  const key = await legacyKeys.load()
  if (key === null) {
    if (stored === null) await saveStoredIndex(EMPTY_ACCOUNT_INDEX)
    return
  }
  const { userId } = (await deriveVault(key)).credentials
  await (await createKeyStore(userId)).save(key)
  await moveLegacyDatabase(userId)
  await saveStoredIndex(withLegacyAccount(stored ?? EMPTY_ACCOUNT_INDEX, userId))
  await legacyKeys.clear()
}
