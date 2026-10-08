import { createProxyDb, type Db, runMigrations } from "@centime/db"
import type { Database } from "sql.js"
import type { Vault } from "@/lib/crypto/envelope"
import { isTauri } from "@/lib/runtime"
import { createAutoSaver, createPersistence } from "./persistence"
import { createSerialQueue } from "./serial-queue"
import { openSqlJsDatabase } from "./sqljs-db"
import { applyConnectionPragmas, createSqlJsExecutor, isWriteStatement } from "./sqljs-executor"

const SAVE_DELAY_MS = 500

export type LocalDatabase = {
  db: Db
  filePath: string
  run<Result>(task: (db: Db) => Promise<Result>): Promise<Result>
  flush(): Promise<void>
  sizeInBytes(): number
}

function exportSnapshot(database: Database): Uint8Array {
  const bytes = database.export()
  applyConnectionPragmas(database)
  return bytes
}

export async function openLocalDb(vault: Vault): Promise<LocalDatabase> {
  const persistence = await createPersistence(vault)
  const initialBytes = await persistence.load()
  const database = await openSqlJsDatabase(initialBytes)
  const queue = createSerialQueue()
  let sizeInBytes = initialBytes?.byteLength ?? 0
  const saver = createAutoSaver({
    persistence,
    delayMs: SAVE_DELAY_MS,
    exportBytes: () => queue(async () => exportSnapshot(database)),
    onSaved: (bytes) => {
      sizeInBytes = bytes.byteLength
    },
    onError: (error) => console.error("Sauvegarde de la base locale impossible", error),
  })
  const db = createProxyDb(
    createSqlJsExecutor(database, (sql) => {
      if (isWriteStatement(sql)) saver.schedule()
    }),
  )
  await runMigrations(db)
  await saver.flush()
  await flushOnExit(() => saver.flush())
  return {
    db,
    filePath: persistence.filePath,
    run: (task) => queue(() => task(db)),
    flush: () => saver.flush(),
    sizeInBytes: () => sizeInBytes,
  }
}

async function flushOnExit(flush: () => Promise<void>): Promise<void> {
  if (isTauri()) {
    const { getCurrentWindow } = await import("@tauri-apps/api/window")
    await getCurrentWindow().onCloseRequested(async () => {
      await flush().catch(() => undefined)
    })
    return
  }
  window.addEventListener("pagehide", () => void flush().catch(() => undefined))
}
