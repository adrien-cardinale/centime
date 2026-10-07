const USER_ID_PATTERN = /^[0-9a-f]{32}$/
const SECRET_PATTERN = /^[A-Za-z0-9_-]{43}$/
const BEARER_PREFIX = "Bearer "

export type Credentials = { userId: string; secretHash: string }

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  return Buffer.from(digest).toString("hex")
}

export async function parseCredentials(header: string | undefined): Promise<Credentials | null> {
  if (!header?.startsWith(BEARER_PREFIX)) return null
  const [userId, secret, ...rest] = header.slice(BEARER_PREFIX.length).trim().split(".")
  if (rest.length > 0 || !userId || !secret) return null
  if (!USER_ID_PATTERN.test(userId) || !SECRET_PATTERN.test(secret)) return null
  return { userId, secretHash: await sha256Hex(secret) }
}
