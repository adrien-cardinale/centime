import type { Context, MiddlewareHandler } from "hono"
import { getConnInfo } from "hono/bun"

export const MINUTE_MS = 60_000
export const HOUR_MS = 60 * MINUTE_MS
export const MAX_TRACKED_KEYS = 10_000
export const TOO_MANY_REQUESTS = "Trop de requêtes, réessayez plus tard"

type Window = { startedAt: number; count: number }

export type Limiter = { consume(key: string): boolean }

export type SignupGate = (c: Context) => boolean

export type LimiterOptions = { limit: number; windowMs: number; maxKeys?: number; now?: () => number }

export function createLimiter({
  limit,
  windowMs,
  maxKeys = MAX_TRACKED_KEYS,
  now = Date.now,
}: LimiterOptions): Limiter {
  const windows = new Map<string, Window>()

  function forgetExpired(at: number): void {
    for (const [key, window] of windows) {
      if (at - window.startedAt < windowMs) return
      windows.delete(key)
    }
  }

  function forgetOldest(): void {
    const oldest = windows.keys().next()
    if (!oldest.done) windows.delete(oldest.value)
  }

  return {
    consume(key) {
      if (limit <= 0) return true
      const at = now()
      forgetExpired(at)
      const window = windows.get(key)
      if (window) {
        window.count += 1
        return window.count <= limit
      }
      if (windows.size >= maxKeys) forgetOldest()
      windows.set(key, { startedAt: at, count: 1 })
      return true
    },
  }
}

function socketAddress(c: Context): string | undefined {
  try {
    return getConnInfo(c).remote.address
  } catch {
    return undefined
  }
}

function forwardedAddress(c: Context): string | undefined {
  const hops = c.req.header("X-Forwarded-For")?.split(",")
  const nearest = hops?.at(-1)?.trim()
  return nearest ? nearest : undefined
}

export function clientIp(c: Context, trustProxy: boolean): string {
  return (trustProxy ? forwardedAddress(c) : undefined) ?? socketAddress(c) ?? "unknown"
}

const USER_ID_PREFIX = /^Bearer ([0-9a-f]{32})\./

export function clientKey(c: Context, trustProxy: boolean): string {
  const userId = USER_ID_PREFIX.exec(c.req.header("Authorization") ?? "")?.[1]
  return userId ? `user:${userId}` : `ip:${clientIp(c, trustProxy)}`
}

export function tooManyRequests(c: Context): Response {
  return c.json({ error: TOO_MANY_REQUESTS }, 429)
}

export type RateLimitOptions = {
  limit: number
  windowMs: number
  key: (c: Context) => string
  applies?: (c: Context) => boolean
}

export function rateLimit({ limit, windowMs, key, applies = () => true }: RateLimitOptions): MiddlewareHandler {
  const limiter = createLimiter({ limit, windowMs })
  return async (c, next) => {
    if (limit <= 0 || !applies(c)) return next()
    if (!limiter.consume(key(c))) return tooManyRequests(c)
    return next()
  }
}
