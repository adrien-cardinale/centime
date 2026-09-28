import { apiTokens, type Db } from "@centime/db"
import { and, desc, eq, isNull } from "drizzle-orm"
import { type Clock, nowIso, systemClock } from "./clock"
import { notFound } from "./errors"

const TOKEN_BYTES = 32
const LAST_USED_REFRESH_MS = 60_000

export type CreatedApiToken = { token: string; label: string }

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  return toHex(new Uint8Array(digest))
}

function generateToken(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(TOKEN_BYTES)))
}

export async function createApiToken(db: Db, { label }: { label: string }, clock: Clock = systemClock) {
  const token = generateToken()
  await db.insert(apiTokens).values({ tokenHash: await sha256Hex(token), label, createdAt: nowIso(clock) })
  const created: CreatedApiToken = { token, label }
  return created
}

export function listApiTokens(db: Db) {
  return db
    .select({
      id: apiTokens.id,
      label: apiTokens.label,
      createdAt: apiTokens.createdAt,
      lastUsedAt: apiTokens.lastUsedAt,
      revokedAt: apiTokens.revokedAt,
    })
    .from(apiTokens)
    .orderBy(desc(apiTokens.createdAt))
}

export async function revokeApiToken(db: Db, { id }: { id: string }, clock: Clock = systemClock) {
  const [revoked] = await db
    .update(apiTokens)
    .set({ revokedAt: nowIso(clock) })
    .where(and(eq(apiTokens.id, id), isNull(apiTokens.revokedAt)))
    .returning({ id: apiTokens.id })
  if (!revoked) throw notFound("Jeton introuvable")
  return { id: revoked.id }
}

function needsLastUsedRefresh(lastUsedAt: string | null, now: Date): boolean {
  return lastUsedAt === null || now.getTime() - Date.parse(lastUsedAt) >= LAST_USED_REFRESH_MS
}

export async function verifyApiToken(db: Db, token: string, clock: Clock = systemClock): Promise<boolean> {
  const tokenHash = await sha256Hex(token)
  const [stored] = await db
    .select({ id: apiTokens.id, lastUsedAt: apiTokens.lastUsedAt })
    .from(apiTokens)
    .where(and(eq(apiTokens.tokenHash, tokenHash), isNull(apiTokens.revokedAt)))
  if (!stored) return false
  const now = clock()
  if (needsLastUsedRefresh(stored.lastUsedAt, now)) {
    await db.update(apiTokens).set({ lastUsedAt: now.toISOString() }).where(eq(apiTokens.id, stored.id))
  }
  return true
}
