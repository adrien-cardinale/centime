import type { CsvProfile, CsvProfileInput } from "@centime/core"
import { csvProfileFromRow, type CsvProfileRow, csvProfiles, csvProfileToRow, type Db } from "@centime/db"
import { and, asc, eq, isNull } from "drizzle-orm"
import { type Clock, nowIso, systemClock } from "./clock"
import { notFound } from "./errors"

export type CsvProfileUpdate = CsvProfileInput & { id: string }

const NOT_FOUND = "Profil introuvable"

function activeProfile(id: string) {
  return and(eq(csvProfiles.id, id), isNull(csvProfiles.deletedAt))
}

function readableProfiles(rows: CsvProfileRow[]): CsvProfile[] {
  return rows.flatMap((row) => {
    const profile = csvProfileFromRow(row)
    return profile ? [profile] : []
  })
}

export async function listCsvProfiles(db: Db): Promise<CsvProfile[]> {
  const rows = await db.select().from(csvProfiles).where(isNull(csvProfiles.deletedAt)).orderBy(asc(csvProfiles.name))
  return readableProfiles(rows)
}

export async function createCsvProfile(db: Db, input: CsvProfileInput): Promise<CsvProfile> {
  const [created] = await db.insert(csvProfiles).values(csvProfileToRow(input)).returning({ id: csvProfiles.id })
  if (!created) throw new Error("Insertion du profil impossible")
  return { ...input, id: created.id }
}

export async function updateCsvProfile(db: Db, { id, ...input }: CsvProfileUpdate): Promise<CsvProfile> {
  const [updated] = await db
    .update(csvProfiles)
    .set(csvProfileToRow(input))
    .where(activeProfile(id))
    .returning({ id: csvProfiles.id })
  if (!updated) throw notFound(NOT_FOUND)
  return { ...input, id: updated.id }
}

export async function deleteCsvProfile(db: Db, { id }: { id: string }, clock: Clock = systemClock) {
  const [deleted] = await db
    .update(csvProfiles)
    .set({ deletedAt: nowIso(clock) })
    .where(activeProfile(id))
    .returning({ id: csvProfiles.id })
  if (!deleted) throw notFound(NOT_FOUND)
  return { id: deleted.id }
}
