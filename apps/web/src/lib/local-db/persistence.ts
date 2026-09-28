import { appDataDir, join } from "@tauri-apps/api/path"
import { exists, mkdir, readFile, rename, writeFile } from "@tauri-apps/plugin-fs"

const DATABASE_FILE = "centime.db"
const TEMPORARY_SUFFIX = ".tmp"

export type Persistence = {
  filePath: string
  load(): Promise<Uint8Array | null>
  save(bytes: Uint8Array): Promise<void>
}

export async function createFilePersistence(): Promise<Persistence> {
  const directory = await appDataDir()
  const filePath = await join(directory, DATABASE_FILE)
  const temporaryPath = `${filePath}${TEMPORARY_SUFFIX}`
  return {
    filePath,
    load: async () => ((await exists(filePath)) ? readFile(filePath) : null),
    save: async (bytes) => {
      await mkdir(directory, { recursive: true })
      await writeFile(temporaryPath, bytes)
      await rename(temporaryPath, filePath)
    },
  }
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
}

export function createAutoSaver({ exportBytes, persistence, delayMs, onSaved, onError }: AutoSaverOptions): AutoSaver {
  let timer: ReturnType<typeof setTimeout> | null = null
  let dirty = false
  let writing: Promise<void> = Promise.resolve()

  const write = async () => {
    if (!dirty) return
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
      dirty = true
      if (timer !== null) clearTimeout(timer)
      timer = setTimeout(() => void flush().catch(() => undefined), delayMs)
    },
    flush,
  }
}
