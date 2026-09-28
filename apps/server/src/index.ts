import { runMigrations, seedDefaultCategories, seedDefaultCsvProfiles, seedDefaultRules } from "@centime/db"
import { createDb } from "@centime/db/node"
import { Hono } from "hono"
import { bodyLimit } from "hono/body-limit"
import { secureHeaders } from "hono/secure-headers"
import { createApi } from "./app"
import { ConfigError, loadConfig } from "./config"
import { mountSpa } from "./static"

const MAX_BODY_BYTES = 12 * 1024 * 1024
const IDLE_TIMEOUT_SECONDS = 120
const BODY_TOO_LARGE = "Requête trop volumineuse (12 Mo maximum)"

async function start(): Promise<void> {
  const config = loadConfig()
  const db = createDb(config.databaseUrl)
  await runMigrations(db)
  await seedDefaultCsvProfiles(db)
  await seedDefaultCategories(db)
  await seedDefaultRules(db)

  const app = new Hono()
  app.use(secureHeaders())
  app.use(bodyLimit({ maxSize: MAX_BODY_BYTES, onError: (c) => c.json({ error: BODY_TOO_LARGE }, 413) }))
  app.route("/", createApi({ db, config }))
  mountSpa(app, config.staticDir)

  // Bun ferme par défaut une connexion inactive après 10 s, trop court pour un gros import.
  const server = Bun.serve({ port: config.port, fetch: app.fetch, idleTimeout: IDLE_TIMEOUT_SECONDS })
  console.log(`centime écoute sur http://localhost:${server.port}`)

  const shutdown = (): void => {
    void server.stop().then(() => process.exit(0))
  }
  process.once("SIGINT", shutdown)
  process.once("SIGTERM", shutdown)
}

start().catch((error: unknown) => {
  if (error instanceof ConfigError) {
    console.error(`Configuration invalide : ${error.message}`)
  } else {
    console.error(error)
  }
  process.exit(1)
})
