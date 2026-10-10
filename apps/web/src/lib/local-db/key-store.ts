import { appDataDir, join } from "@tauri-apps/api/path"
import { exists, mkdir, readFile, remove, writeFile } from "@tauri-apps/plugin-fs"
import { isTauri } from "@/lib/runtime"
import { accountDirectory, accountEntry } from "./account-paths"
import { idbDelete, idbGet, idbSet } from "./idb"

const KEY_FILE = "master.key"
const KEY_ENTRY = "master-key"

export type KeyStore = {
  load(): Promise<Uint8Array | null>
  save(key: Uint8Array): Promise<void>
  clear(): Promise<void>
}

async function createFileKeyStore(directory: string): Promise<KeyStore> {
  const path = await join(directory, KEY_FILE)
  return {
    load: async () => ((await exists(path)) ? readFile(path) : null),
    save: async (key) => {
      await mkdir(directory, { recursive: true })
      await writeFile(path, key)
    },
    clear: async () => {
      if (await exists(path)) await remove(path)
    },
  }
}

function createEntryKeyStore(entry: string): KeyStore {
  return {
    load: () => idbGet(entry),
    save: (key) => idbSet(entry, key),
    clear: () => idbDelete(entry),
  }
}

/** La clé maître reste sur l'appareil : fichier du dossier de données (Tauri) ou IndexedDB (navigateur). */
export async function createKeyStore(id: string): Promise<KeyStore> {
  return isTauri() ? createFileKeyStore(await accountDirectory(id)) : createEntryKeyStore(accountEntry(KEY_ENTRY, id))
}

export async function createLegacyKeyStore(): Promise<KeyStore> {
  return isTauri() ? createFileKeyStore(await appDataDir()) : createEntryKeyStore(KEY_ENTRY)
}
