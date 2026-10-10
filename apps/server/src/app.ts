import { Hono, type MiddlewareHandler } from "hono"
import { cors } from "hono/cors"
import { HTTPException } from "hono/http-exception"
import { rateLimit } from "./rate-limit"
import { createAccountRoutes } from "./routes/account"
import { healthRoutes } from "./routes/health"
import { createLogRoutes } from "./routes/log"
import type { Store } from "./store"

export type AppDeps = { store: Store; rateLimitPerMinute?: number; allowedOrigins?: string[] }

const CORS_METHODS = ["GET", "POST", "DELETE"]
const CORS_HEADERS = ["Authorization", "Content-Type"]

function corsFor(allowedOrigins: string[]): MiddlewareHandler {
  if (allowedOrigins.length === 0) return (_c, next) => next()
  return cors({ origin: allowedOrigins, allowMethods: CORS_METHODS, allowHeaders: CORS_HEADERS })
}

export function createApi({ store, rateLimitPerMinute = 0, allowedOrigins = [] }: AppDeps) {
  return new Hono()
    .basePath("/api")
    .onError((error, c) => {
      if (error instanceof HTTPException) return error.getResponse()
      console.error(error)
      return c.json({ error: "Erreur interne du serveur" }, 500)
    })
    .notFound((c) => c.json({ error: "Ressource introuvable" }, 404))
    .use(corsFor(allowedOrigins))
    .use(rateLimit(rateLimitPerMinute))
    .route("/health", healthRoutes)
    .route("/log", createLogRoutes({ store }))
    .route("/account", createAccountRoutes(store))
}
