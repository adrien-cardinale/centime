import { type CsvProfile, csvProfileSchema } from "@centime/core"
import { csvProfileFromRow, type CsvProfileRow, csvProfiles, csvProfileToRow, type Db } from "@centime/db"
import { zValidator } from "@hono/zod-validator"
import { and, asc, eq, isNull } from "drizzle-orm"
import { Hono } from "hono"
import { z } from "zod"

const idParamSchema = z.object({ id: z.string().min(1) })

function activeProfile(id: string) {
  return and(eq(csvProfiles.id, id), isNull(csvProfiles.deletedAt))
}

function readableProfiles(rows: CsvProfileRow[]): CsvProfile[] {
  return rows.flatMap((row) => {
    const profile = csvProfileFromRow(row)
    return profile ? [profile] : []
  })
}

export function createCsvProfileRoutes(db: Db) {
  return new Hono()
    .get("/", async (c) => {
      const rows = await db.select().from(csvProfiles).where(isNull(csvProfiles.deletedAt)).orderBy(asc(csvProfiles.name))
      return c.json(readableProfiles(rows), 200)
    })
    .post("/", zValidator("json", csvProfileSchema), async (c) => {
      const input = c.req.valid("json")
      const [created] = await db.insert(csvProfiles).values(csvProfileToRow(input)).returning({ id: csvProfiles.id })
      if (!created) throw new Error("Insertion du profil impossible")
      const profile: CsvProfile = { ...input, id: created.id }
      return c.json(profile, 201)
    })
    .put("/:id", zValidator("param", idParamSchema), zValidator("json", csvProfileSchema), async (c) => {
      const { id } = c.req.valid("param")
      const input = c.req.valid("json")
      const [updated] = await db
        .update(csvProfiles)
        .set(csvProfileToRow(input))
        .where(activeProfile(id))
        .returning({ id: csvProfiles.id })
      if (!updated) return c.json({ error: "Profil introuvable" }, 404)
      const profile: CsvProfile = { ...input, id: updated.id }
      return c.json(profile, 200)
    })
    .delete("/:id", zValidator("param", idParamSchema), async (c) => {
      const { id } = c.req.valid("param")
      const [deleted] = await db
        .update(csvProfiles)
        .set({ deletedAt: new Date().toISOString() })
        .where(activeProfile(id))
        .returning({ id: csvProfiles.id })
      if (!deleted) return c.json({ error: "Profil introuvable" }, 404)
      return c.json({ id: deleted.id }, 200)
    })
}
