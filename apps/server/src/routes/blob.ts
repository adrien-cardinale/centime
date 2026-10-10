import { type Context, Hono } from "hono"
import { type Credentials, parseCredentials } from "../auth"
import type { Store } from "../store"
import { INVALID_BODY, QUOTA_EXCEEDED, SIGNUP_CLOSED, UNAUTHORIZED } from "./log"

export const MAX_BLOB_BYTES = 8 * 1024 * 1024
const BLOB_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const INVALID_ID = "Identifiant de fichier invalide"
const BLOB_TOO_LARGE = "Fichier trop volumineux (8 Mo maximum)"
const BLOB_NOT_FOUND = "Fichier introuvable"

export type BlobRouteOptions = { store: Store }

type Reader = { credentials: Credentials; known: boolean }

function parseBlobId(c: Context): string | null {
  const id = c.req.param("id") ?? ""
  return BLOB_ID_PATTERN.test(id) ? id.toLowerCase() : null
}

async function authorizeReader(c: Context, store: Store): Promise<Reader | null> {
  const credentials = await parseCredentials(c.req.header("Authorization"))
  if (!credentials) return null
  const access = store.check(credentials.userId, credentials.secretHash)
  if (access === "unauthorized") return null
  return { credentials, known: access === "ok" }
}

export function createBlobRoutes({ store }: BlobRouteOptions) {
  return new Hono()
    .get("/", async (c) => {
      const reader = await authorizeReader(c, store)
      if (!reader) return c.json({ error: UNAUTHORIZED }, 401)
      const ids = reader.known ? store.listBlobs(reader.credentials.userId) : []
      return c.json({ ids }, 200)
    })
    .get("/:id", async (c) => {
      const reader = await authorizeReader(c, store)
      if (!reader) return c.json({ error: UNAUTHORIZED }, 401)
      const id = parseBlobId(c)
      if (!id) return c.json({ error: INVALID_ID }, 400)
      const data = reader.known ? store.getBlob(reader.credentials.userId, id) : null
      if (!data) return c.json({ error: BLOB_NOT_FOUND }, 404)
      return c.body(new Uint8Array(data), 200, { "Content-Type": "application/octet-stream" })
    })
    .delete("/:id", async (c) => {
      const reader = await authorizeReader(c, store)
      if (!reader) return c.json({ error: UNAUTHORIZED }, 401)
      const id = parseBlobId(c)
      if (!id) return c.json({ error: INVALID_ID }, 400)
      if (reader.known) store.deleteBlob(reader.credentials.userId, id)
      return c.body(null, 204)
    })
    .put("/:id", async (c) => {
      const credentials = await parseCredentials(c.req.header("Authorization"))
      if (!credentials) return c.json({ error: UNAUTHORIZED }, 401)
      const id = parseBlobId(c)
      if (!id) return c.json({ error: INVALID_ID }, 400)
      const data = new Uint8Array(await c.req.arrayBuffer())
      if (data.byteLength === 0) return c.json({ error: INVALID_BODY }, 400)
      if (data.byteLength > MAX_BLOB_BYTES) return c.json({ error: BLOB_TOO_LARGE }, 413)
      const result = store.putBlob(credentials.userId, credentials.secretHash, id, data)
      if (result.kind === "unauthorized") return c.json({ error: UNAUTHORIZED }, 401)
      if (result.kind === "signup-closed") return c.json({ error: SIGNUP_CLOSED }, 403)
      if (result.kind === "quota-exceeded") return c.json({ error: QUOTA_EXCEEDED }, 413)
      return c.body(null, result.created ? 201 : 204)
    })
}
