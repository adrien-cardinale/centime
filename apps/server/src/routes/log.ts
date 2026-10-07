import { Hono } from "hono"
import { z } from "zod"
import { parseCredentials } from "../auth"
import type { Store } from "../store"

export const MAX_DATA_LENGTH = 8 * 1024 * 1024
const DEFAULT_LIMIT = 200
const MAX_LIMIT = 500
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/

const UNAUTHORIZED = "Identifiants invalides"
const SIGNUP_CLOSED = "Les inscriptions sont fermées sur ce serveur"
const INVALID_BODY = "Corps de requête invalide"
const INVALID_QUERY = "Paramètres de requête invalides"

const bodySchema = z.object({ data: z.string().min(1).max(MAX_DATA_LENGTH).regex(BASE64_PATTERN) })
const integer = (min: number) => z.coerce.number().int().min(min)
const querySchema = z.object({
  since: integer(0).default(0),
  limit: integer(1).default(DEFAULT_LIMIT),
})

export type LogRouteOptions = { store: Store; allowSignup?: boolean }

export function createLogRoutes({ store }: LogRouteOptions) {
  return new Hono()
    .get("/", async (c) => {
      const credentials = await parseCredentials(c.req.header("Authorization"))
      if (!credentials) return c.json({ error: UNAUTHORIZED }, 401)
      const query = querySchema.safeParse(c.req.query())
      if (!query.success) return c.json({ error: INVALID_QUERY }, 400)
      const access = store.check(credentials.userId, credentials.secretHash)
      if (access === "unauthorized") return c.json({ error: UNAUTHORIZED }, 401)
      const { since, limit } = query.data
      if (access === "unknown") return c.json({ entries: [], cursor: since, hasMore: false }, 200)
      return c.json(store.read(credentials.userId, since, Math.min(limit, MAX_LIMIT)), 200)
    })
    .post("/", async (c) => {
      const credentials = await parseCredentials(c.req.header("Authorization"))
      if (!credentials) return c.json({ error: UNAUTHORIZED }, 401)
      const body = bodySchema.safeParse(await c.req.json().catch(() => null))
      if (!body.success) return c.json({ error: INVALID_BODY }, 400)
      const result = store.append(credentials.userId, credentials.secretHash, body.data.data)
      if (result.kind === "unauthorized") return c.json({ error: UNAUTHORIZED }, 401)
      if (result.kind === "signup-closed") return c.json({ error: SIGNUP_CLOSED }, 403)
      return c.json({ seq: result.seq }, 201)
    })
}
