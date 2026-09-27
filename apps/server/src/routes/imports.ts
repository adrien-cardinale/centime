import { csvProfiles, type Db, imports } from "@centime/db"
import { zValidator } from "@hono/zod-validator"
import { desc, eq, isNull } from "drizzle-orm"
import { Hono } from "hono"
import { bodyLimit } from "hono/body-limit"
import { z } from "zod"
import { analyzeImport, commitImport, ImportRequestError, type ImportSource, toImportPreview } from "../services/import"

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
const UPLOAD_TOO_LARGE = "Fichier trop volumineux (10 Mo maximum)"

const optionalId = z
  .string()
  .optional()
  .transform((value) => value || undefined)

const uploadSchema = z.object({
  file: z.instanceof(File),
  profileId: optionalId,
  accountId: optionalId,
})

type Upload = z.infer<typeof uploadSchema>

const uploadLimit = bodyLimit({
  maxSize: MAX_UPLOAD_BYTES,
  onError: (c) => c.json({ error: UPLOAD_TOO_LARGE }, 413),
})

const uploadValidator = zValidator("form", uploadSchema, (result, c) => {
  if (!result.success) return c.json({ error: "Fichier manquant ou invalide" }, 400)
})

async function toImportSource(upload: Upload): Promise<ImportSource> {
  if (upload.file.size > MAX_UPLOAD_BYTES) throw new ImportRequestError(UPLOAD_TOO_LARGE)
  return {
    bytes: new Uint8Array(await upload.file.arrayBuffer()),
    fileName: upload.file.name,
    profileId: upload.profileId,
    accountId: upload.accountId,
  }
}

function listImports(db: Db) {
  return db
    .select({
      id: imports.id,
      fileName: imports.fileName,
      format: imports.format,
      profileId: imports.profileId,
      profileName: csvProfiles.name,
      importedAt: imports.importedAt,
      insertedCount: imports.insertedCount,
      skippedCount: imports.skippedCount,
      updatedCount: imports.updatedCount,
    })
    .from(imports)
    .leftJoin(csvProfiles, eq(imports.profileId, csvProfiles.id))
    .where(isNull(imports.deletedAt))
    .orderBy(desc(imports.importedAt))
}

export function createImportRoutes(db: Db) {
  return new Hono()
    .get("/", async (c) => c.json(await listImports(db), 200))
    .post("/preview", uploadLimit, uploadValidator, async (c) => {
      try {
        const analysis = await analyzeImport(db, await toImportSource(c.req.valid("form")))
        return c.json(toImportPreview(analysis), 200)
      } catch (error) {
        if (error instanceof ImportRequestError) return c.json({ error: error.message }, error.status)
        throw error
      }
    })
    .post("/", uploadLimit, uploadValidator, async (c) => {
      try {
        const outcome = await commitImport(db, await toImportSource(c.req.valid("form")))
        return c.json(outcome, 201)
      } catch (error) {
        if (error instanceof ImportRequestError) return c.json({ error: error.message }, error.status)
        throw error
      }
    })
}
