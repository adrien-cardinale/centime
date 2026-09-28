import type { Db } from "@centime/db"
import { commitImport, type ImportSource, listImports, previewImport, ServiceError } from "@centime/services"
import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import { bodyLimit } from "hono/body-limit"
import { z } from "zod"

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
  if (upload.file.size > MAX_UPLOAD_BYTES) throw new ServiceError(UPLOAD_TOO_LARGE)
  return {
    bytes: new Uint8Array(await upload.file.arrayBuffer()),
    fileName: upload.file.name,
    profileId: upload.profileId,
    accountId: upload.accountId,
  }
}

export function createImportRoutes(db: Db) {
  return new Hono()
    .get("/", async (c) => c.json(await listImports(db), 200))
    .post("/preview", uploadLimit, uploadValidator, async (c) =>
      c.json(await previewImport(db, await toImportSource(c.req.valid("form"))), 200),
    )
    .post("/", uploadLimit, uploadValidator, async (c) =>
      c.json(await commitImport(db, await toImportSource(c.req.valid("form"))), 201),
    )
}
