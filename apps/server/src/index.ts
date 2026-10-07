import { Hono } from "hono"
import { bodyLimit } from "hono/body-limit"
import { secureHeaders } from "hono/secure-headers"
import { createApi } from "./app"
import { ConfigError, loadConfig } from "./config"
import { mountSpa } from "./static"
import { openStore } from "./store"

const MAX_BODY_BYTES = 9 * 1024 * 1024
const BODY_TOO_LARGE = "Requête trop volumineuse (9 Mo maximum)"

function start(): void {
  const config = loadConfig()
  const store = openStore(config.databasePath, { allowSignup: config.allowSignup })

  const app = new Hono()
  app.use(secureHeaders())
  app.use(bodyLimit({ maxSize: MAX_BODY_BYTES, onError: (c) => c.json({ error: BODY_TOO_LARGE }, 413) }))
  app.route("/", createApi({ store }))
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
