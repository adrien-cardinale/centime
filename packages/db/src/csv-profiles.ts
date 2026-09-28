import { type CsvProfile, type CsvProfileInput, csvProfileSchema, DEFAULT_CSV_PROFILES } from "@centime/core"
import type { DbExecutor } from "./client"
import { type CsvProfileRow, csvProfiles, type NewCsvProfileRow } from "./schema"
import { type SeedOptions, seedTimestamps } from "./seed-options"

export function csvProfileToRow(profile: CsvProfileInput): Pick<NewCsvProfileRow, "name" | "config"> {
  const { name, ...config } = profile
  return { name, config: JSON.stringify(config) }
}

export function csvProfileFromRow(row: Pick<CsvProfileRow, "id" | "name" | "config">): CsvProfile | null {
  let config: unknown
  try {
    config = JSON.parse(row.config)
  } catch {
    return null
  }
  const parsed = csvProfileSchema.safeParse({ ...(typeof config === "object" ? config : {}), name: row.name })
  return parsed.success ? { ...parsed.data, id: row.id } : null
}

export async function seedDefaultCsvProfiles(db: DbExecutor, options: SeedOptions = {}): Promise<void> {
  const rows = DEFAULT_CSV_PROFILES.map((profile) => ({
    id: profile.id,
    ...csvProfileToRow(profile),
    ...seedTimestamps(options),
  }))
  await db.insert(csvProfiles).values(rows).onConflictDoNothing({ target: csvProfiles.id })
}
