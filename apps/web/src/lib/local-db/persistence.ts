import { appDataDir, join } from "@tauri-apps/api/path"
import { exists, mkdir, readFile, remove, rename, writeFile } from "@tauri-apps/plugin-fs"
import { isSealed, type Vault } from "@/lib/crypto/envelope"
import { isTauri } from "@/lib/runtime"
import { accountDirectory, accountEntry } from "./account-paths"
import { idbDelete, idbGet, idbSet } from "./idb"

const DATABASE_FILE = "centime.db"
const TEMPORARY_SUFFIX = ".tmp"

const BROWSER_LOCATION = "Stockage du navigateur (IndexedDB)"
const BROWSER_ENTRY = "database"
const SQLITE_HEADER = "SQLite format 3\0"
const UNKNOWN_FORMAT = "Format de la base locale inconnu"

export type Persistence = {
  filePath: string
  load(): Promise<Uint8Array | null>
  save(bytes: Uint8Array): Promise<void>
  remove(): Promise<void>
}

export async function createFileStore(directory: string, fileName: string): Promise<Persistence> {
  const filePath = await join(directory, fileName)
  const temporaryPath = `${filePath}${TEMPORARY_SUFFIX}`
  return {
    filePath,
    load: async () => ((await exists(filePath)) ? readFile(filePath) : null),
    save: async (bytes) => {
      await mkdir(directory, { recursive: true })
      await writeFile(temporaryPath, bytes)
      await rename(temporaryPath, filePath)
    },
    remove: async () => {
      for (const path of [temporaryPath, filePath]) if (await exists(path)) await remove(path)
    },
  }
}

export function createEntryStore(entry: string): Persistence {
  return {
    filePath: BROWSER_LOCATION,
    load: () => idbGet(entry),
    save: (bytes) => idbSet(entry, bytes),
    remove: () => idbDelete(entry),
  }
}

export async function createDatabaseStore(id: string): Promise<Persistence> {
  if (!isTauri()) return createEntryStore(accountEntry(BROWSER_ENTRY, id))
  return createFileStore(await accountDirectory(id), DATABASE_FILE)
}

export async function createLegacyDatabaseStore(): Promise<Persistence> {
  return isTauri() ? createFileStore(await appDataDir(), DATABASE_FILE) : createEntryStore(BROWSER_ENTRY)
}

function isPlainSqlite(bytes: Uint8Array): boolean {
  return new TextDecoder().decode(bytes.subarray(0, SQLITE_HEADER.length)) === SQLITE_HEADER
}

/** Chiffre tout ce qui est écrit. Une base en clair d'une ancienne version est lue puis rechiffrée à la prochaine sauvegarde. */
export function withEncryption(inner: Persistence, vault: Vault): Persistence {
  return {
    filePath: inner.filePath,
    load: async () => {
      const bytes = await inner.load()
      if (bytes === null) return null
      if (isSealed(bytes)) return vault.decrypt(bytes)
      if (isPlainSqlite(bytes)) return bytes
      throw new Error(UNKNOWN_FORMAT)
    },
    save: async (bytes) => inner.save(await vault.encrypt(bytes)),
    remove: () => inner.remove(),
  }
}

export async function createPersistence(vault: Vault): Promise<Persistence> {
  return withEncryption(await createDatabaseStore(vault.credentials.userId), vault)
}

export type AutoSaverOptions = {
  exportBytes: () => Promise<Uint8Array>
  persistence: Persistence
  delayMs: number
  onSaved?: (bytes: Uint8Array) => void
  onError?: (error: unknown) => void
}

export type AutoSaver = {
  schedule(): void
  flush(): Promise<void>
  stop(): Promise<void>
}

export function createAutoSaver({ exportBytes, persistence, delayMs, onSaved, onError }: AutoSaverOptions): AutoSaver {
  let timer: ReturnType<typeof setTimeout> | null = null
  let dirty = false
  let writing: Promise<void> = Promise.resolve()
  let stopped = false

  const write = async () => {
    if (stopped || !dirty) return
    dirty = false
    const bytes = await exportBytes()
    await persistence.save(bytes)
    onSaved?.(bytes)
  }

  const flush = () => {
    if (timer !== null) clearTimeout(timer)
    timer = null
    writing = writing.then(write).catch((error: unknown) => {
      dirty = true
      onError?.(error)
      throw error
    })
    const current = writing
    writing = writing.catch(() => undefined)
    return current
  }

  return {
    schedule: () => {
      if (stopped) return
      dirty = true
      if (timer !== null) clearTimeout(timer)
      timer = setTimeout(() => void flush().catch(() => undefined), delayMs)
    },
    flush,
    stop: async () => {
      stopped = true
      if (timer !== null) clearTimeout(timer)
      timer = null
      await writing
    },
  }
}
