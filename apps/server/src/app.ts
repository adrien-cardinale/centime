import { Hono, type MiddlewareHandler } from "hono"
import { cors } from "hono/cors"
import { HTTPException } from "hono/http-exception"
import { clientIp, clientKey, createLimiter, HOUR_MS, MINUTE_MS, rateLimit, type SignupGate } from "./rate-limit"
import { createAccountRoutes } from "./routes/account"
import { createBlobRoutes } from "./routes/blob"
import { healthRoutes } from "./routes/health"
import { createLogRoutes } from "./routes/log"
import type { Store } from "./store"

export type AppDeps = {
  store: Store
  rateLimitPerMinute?: number
  writeRateLimitPerMinute?: number
  signupRateLimitPerHour?: number
  trustProxy?: boolean
  allowedOrigins?: string[]
}

const WRITE_METHODS = new Set(["POST", "PUT", "DELETE"])

const CORS_METHODS = ["GET", "POST", "PUT", "DELETE"]
const CORS_HEADERS = ["Authorization", "Content-Type"]

function corsFor(allowedOrigins: string[]): MiddlewareHandler {
  if (allowedOrigins.length === 0) return (_c, next) => next()
  return cors({ origin: allowedOrigins, allowMethods: CORS_METHODS, allowHeaders: CORS_HEADERS })
}

export function createApi({
  store,
  rateLimitPerMinute = 0,
  writeRateLimitPerMinute = 0,
  signupRateLimitPerHour = 0,
  trustProxy = false,
  allowedOrigins = [],
}: AppDeps) {
  const signups = createLimiter({ limit: signupRateLimitPerHour, windowMs: HOUR_MS })
  const admitSignup: SignupGate = (c) => signups.consume(clientIp(c, trustProxy))
  return new Hono()
    .basePath("/api")
    .onError((error, c) => {
      if (error instanceof HTTPException) return error.getResponse()
      console.error(error)
      return c.json({ error: "Erreur interne du serveur" }, 500)
    })
    .notFound((c) => c.json({ error: "Ressource introuvable" }, 404))
    .use(corsFor(allowedOrigins))
    .use(
      rateLimit({
        limit: writeRateLimitPerMinute,
        windowMs: MINUTE_MS,
        key: (c) => clientIp(c, trustProxy),
        applies: (c) => WRITE_METHODS.has(c.req.method),
      }),
    )
    .use(rateLimit({ limit: rateLimitPerMinute, windowMs: MINUTE_MS, key: (c) => clientKey(c, trustProxy) }))
    .route("/health", healthRoutes)
    .route("/log", createLogRoutes({ store, admitSignup }))
    .route("/blob", createBlobRoutes({ store, admitSignup }))
    .route("/account", createAccountRoutes(store))
}
