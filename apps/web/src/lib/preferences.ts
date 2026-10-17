import { type DbExecutor, preferences } from "@centime/db"
import { and, eq, isNull } from "@centime/db/orm"

// Un id fixe par clé : tous les appareils écrivent la même ligne, la plus récente gagne à la synchronisation.
const PREFERENCE_IDS = {
  "receipts.ai": "64a2e8cc-ced4-4753-bacf-34e21c2e3d97",
} as const

export type PreferenceKey = keyof typeof PREFERENCE_IDS

export async function readPreference(db: DbExecutor, key: PreferenceKey): Promise<string | undefined> {
  const [row] = await db
    .select({ value: preferences.value })
    .from(preferences)
    .where(and(eq(preferences.id, PREFERENCE_IDS[key]), isNull(preferences.deletedAt)))
  return row?.value
}

export async function writePreference(db: DbExecutor, key: PreferenceKey, value: string): Promise<void> {
  const now = new Date().toISOString()
  await db
    .insert(preferences)
    .values({ id: PREFERENCE_IDS[key], key, value, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: preferences.id,
      set: { value, updatedAt: now, deletedAt: null, syncVersion: null },
    })
}
