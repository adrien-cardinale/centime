import { appDataDir, join } from "@tauri-apps/api/path"
import { exists, mkdir, readFile, writeFile } from "@tauri-apps/plugin-fs"
import { isTauri } from "@/lib/runtime"
import { idbGet, idbSet } from "./idb"

const KEY_FILE = "master.key"
const KEY_ENTRY = "master-key"

export type KeyStore = {
  load(): Promise<Uint8Array | null>
  save(key: Uint8Array): Promise<void>
}

async function createFileKeyStore(): Promise<KeyStore> {
  const directory = await appDataDir()
  const path = await join(directory, KEY_FILE)
  return {
    load: async () => ((await exists(path)) ? readFile(path) : null),
    save: async (key) => {
      await mkdir(directory, { recursive: true })
      await writeFile(path, key)
    },
  }
}

const idbKeyStore: KeyStore = {
  load: () => idbGet(KEY_ENTRY),
  save: (key) => idbSet(KEY_ENTRY, key),
}

/** La clé maître reste sur l'appareil : fichier du dossier de données (Tauri) ou IndexedDB (navigateur). */
export async function createKeyStore(): Promise<KeyStore> {
  return isTauri() ? createFileKeyStore() : idbKeyStore
}
