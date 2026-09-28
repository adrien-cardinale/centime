import { type Db, sessions } from "@centime/db"
import { verifyApiToken } from "@centime/services"
import { eq } from "drizzle-orm"
import type { Context } from "hono"
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie"
import { createMiddleware } from "hono/factory"
import type { Config } from "../config"

const SESSION_COOKIE = "centime_session"
const SESSION_DURATION_SECONDS = 30 * 24 * 60 * 60
const PUBLIC_API_PATHS = new Set(["/api/health", "/api/auth/login", "/api/auth/me", "/api/auth/token"])
const BEARER_PREFIX = "Bearer "

export type AuthDeps = { db: Db; config: Config }

export async function createSession(c: Context, { db, config }: AuthDeps): Promise<void> {
  const id = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + SESSION_DURATION_SECONDS * 1000)
  await db.insert(sessions).values({ id, expiresAt: expiresAt.toISOString() })
  await setSignedCookie(c, SESSION_COOKIE, id, config.sessionSecret, {
    httpOnly: true,
    sameSite: "Lax",
    secure: config.isProduction,
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
    expires: expiresAt,
  })
}

async function readSessionId(c: Context, config: Config): Promise<string | null> {
  const value = await getSignedCookie(c, config.sessionSecret, SESSION_COOKIE)
  return typeof value === "string" ? value : null
}

export async function hasValidSession(c: Context, { db, config }: AuthDeps): Promise<boolean> {
  const sessionId = await readSessionId(c, config)
  if (!sessionId) return false
  const session = await db.query.sessions.findFirst({ where: eq(sessions.id, sessionId) })
  if (!session) return false
  if (session.expiresAt > new Date().toISOString()) return true
  await db.delete(sessions).where(eq(sessions.id, sessionId))
  return false
}

export async function destroySession(c: Context, { db, config }: AuthDeps): Promise<void> {
  const sessionId = await readSessionId(c, config)
  if (sessionId) await db.delete(sessions).where(eq(sessions.id, sessionId))
  deleteCookie(c, SESSION_COOKIE, { path: "/", secure: config.isProduction })
}

function bearerTokenOf(c: Context): string | null {
  const header = c.req.header("Authorization")
  if (!header?.startsWith(BEARER_PREFIX)) return null
  const token = header.slice(BEARER_PREFIX.length).trim()
  return token.length > 0 ? token : null
}

async function hasValidBearerToken(c: Context, { db }: AuthDeps): Promise<boolean> {
  const token = bearerTokenOf(c)
  return token !== null && (await verifyApiToken(db, token))
}

async function isAuthenticated(c: Context, deps: AuthDeps): Promise<boolean> {
  return (await hasValidSession(c, deps)) || (await hasValidBearerToken(c, deps))
}

export function requireAuth(deps: AuthDeps) {
  return createMiddleware(async (c, next) => {
    if (PUBLIC_API_PATHS.has(c.req.path) || (await isAuthenticated(c, deps))) {
      await next()
      return
    }
    return c.json({ error: "Non authentifié" }, 401)
  })
}
