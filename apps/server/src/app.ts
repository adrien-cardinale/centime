import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { createAccountRoutes } from "./routes/account"
import { healthRoutes } from "./routes/health"
import { createLogRoutes } from "./routes/log"
import type { Store } from "./store"

export type AppDeps = { store: Store }

export function createApi({ store }: AppDeps) {
  return new Hono()
    .basePath("/api")
    .onError((error, c) => {
      if (error instanceof HTTPException) return error.getResponse()
      console.error(error)
      return c.json({ error: "Erreur interne du serveur" }, 500)
    })
    .notFound((c) => c.json({ error: "Ressource introuvable" }, 404))
    .route("/health", healthRoutes)
    .route("/log", createLogRoutes({ store }))
    .route("/account", createAccountRoutes(store))
}
