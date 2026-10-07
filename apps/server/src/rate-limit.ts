import type { MiddlewareHandler } from "hono"

const WINDOW_MS = 60_000
const PRUNE_THRESHOLD = 10_000

type Window = { startedAt: number; count: number }

/**
 * Limitation en mémoire par fenêtre fixe d'une minute, par en-tête Authorization (un client = un couple
 * identifiant/secret). Suffisant pour protéger un relais auto-hébergé ; limit <= 0 désactive la limitation.
 */
export function rateLimit(limit: number): MiddlewareHandler {
  const windows = new Map<string, Window>()
  return async (c, next) => {
    if (limit <= 0) return next()
    const now = Date.now()
    if (windows.size > PRUNE_THRESHOLD) {
      for (const [key, window] of windows) if (now - window.startedAt >= WINDOW_MS) windows.delete(key)
    }
    const key = c.req.header("Authorization") ?? "anonymous"
    const window = windows.get(key)
    if (!window || now - window.startedAt >= WINDOW_MS) {
      windows.set(key, { startedAt: now, count: 1 })
      return next()
    }
    window.count += 1
    if (window.count > limit) return c.json({ error: "Trop de requêtes, réessayez dans une minute" }, 429)
    return next()
  }
}
