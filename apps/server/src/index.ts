import { Hono } from "hono"
import { bodyLimit } from "hono/body-limit"
import { HTTPException } from "hono/http-exception"
import { secureHeaders } from "hono/secure-headers"
import { createApi } from "./app"
import { ConfigError, loadConfig } from "./config"
import { mountSpa } from "./static"
import { openStore } from "./store"

const MAX_BODY_BYTES = 9 * 1024 * 1024
const BODY_TOO_LARGE = "Requête trop volumineuse (9 Mo maximum)"

function start(): void {
  const config = loadConfig()
  const store = openStore(config.databasePath, {
    allowSignup: config.allowSignup,
    ...(config.maxUserBytes === undefined ? {} : { maxUserBytes: config.maxUserBytes }),
  })

  const app = new Hono()
  // Les onError/notFound d'une sous-app ne sont pas repris par app.route() : le contrat JSON de /api se déclare ici.
  app.onError((error, c) => {
    if (error instanceof HTTPException) return error.getResponse()
    console.error(error)
    const message = "Erreur interne du serveur"
    return c.req.path.startsWith("/api") ? c.json({ error: message }, 500) : c.text(message, 500)
  })
  app.notFound((c) =>
    c.req.path.startsWith("/api") ? c.json({ error: "Ressource introuvable" }, 404) : c.text("404 Not Found", 404),
  )
  app.use(secureHeaders())
  app.use(bodyLimit({ maxSize: MAX_BODY_BYTES, onError: (c) => c.json({ error: BODY_TOO_LARGE }, 413) }))
  app.route("/", createApi({ store, rateLimitPerMinute: config.rateLimitPerMinute }))
  mountSpa(app, config.staticDir)

  const server = Bun.serve({ port: config.port, fetch: app.fetch, idleTimeout: 120 })
  console.log(`centime (relais chiffré) écoute sur http://localhost:${server.port}`)

  const shutdown = (): void => {
    void server.stop().then(() => {
      store.close()
      process.exit(0)
    })
  }
  process.once("SIGINT", shutdown)
  process.once("SIGTERM", shutdown)
}

try {
  start()
} catch (error: unknown) {
  if (error instanceof ConfigError) console.error(`Configuration invalide : ${error.message}`)
  else console.error(error)
  process.exit(1)
}
