import { type DbExecutor, settings } from "@centime/db"
import { inArray } from "@centime/db/orm"

export const SYNC_SETTING_KEYS = {
  serverUrl: "sync_server_url",
  token: "sync_token",
  cursor: "sync_cursor",
  lastAt: "sync_last_at",
  lastError: "sync_last_error",
} as const

type SyncSettingName = keyof typeof SYNC_SETTING_KEYS

export type SyncSettings = {
  serverUrl: string | null
  token: string | null
  cursor: number
  lastAt: string | null
  lastError: string | null
}

export async function readSyncSettings(db: DbExecutor): Promise<SyncSettings> {
  const rows = await db
    .select()
    .from(settings)
    .where(inArray(settings.key, Object.values(SYNC_SETTING_KEYS)))
  const values = new Map(rows.map((row) => [row.key, row.value]))
  const valueOf = (name: SyncSettingName) => values.get(SYNC_SETTING_KEYS[name]) ?? null
  return {
    serverUrl: valueOf("serverUrl"),
    token: valueOf("token"),
    cursor: Number(valueOf("cursor") ?? 0) || 0,
    lastAt: valueOf("lastAt"),
    lastError: valueOf("lastError"),
  }
}

export async function writeSyncSetting(db: DbExecutor, name: SyncSettingName, value: string | number): Promise<void> {
  const text = String(value)
  await db
    .insert(settings)
    .values({ key: SYNC_SETTING_KEYS[name], value: text })
    .onConflictDoUpdate({ target: settings.key, set: { value: text } })
}

export async function clearSyncSetting(db: DbExecutor, ...names: SyncSettingName[]): Promise<void> {
  await db.delete(settings).where(inArray(settings.key, names.map((name) => SYNC_SETTING_KEYS[name])))
}
