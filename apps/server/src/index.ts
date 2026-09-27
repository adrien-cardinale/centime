import { createDb, runMigrations, seedDefaultCategories, seedDefaultCsvProfiles, seedDefaultRules } from "@centime/db"
import { serve } from "@hono/node-server"
import { Hono } from "hono"
import { bodyLimit } from "hono/body-limit"
import { secureHeaders } from "hono/secure-headers"
import { createApi } from "./app"
import { ConfigError, loadConfig } from "./config"
import { migrationsFolder } from "./paths"
import { mountSpa } from "./static"

const MAX_BODY_BYTES = 12 * 1024 * 1024
const BODY_TOO_LARGE = "Requête trop volumineuse (12 Mo maximum)"

async function start(): Promise<void> {
  const config = loadConfig()
  const db = createDb(config.databaseUrl)
  await runMigrations(db, migrationsFolder)
  await seedDefaultCsvProfiles(db)
  await seedDefaultCategories(db)
  await seedDefaultRules(db)

  const app = new Hono()
  app.use(secureHeaders())
  app.use(bodyLimit({ maxSize: MAX_BODY_BYTES, onError: (c) => c.json({ error: BODY_TOO_LARGE }, 413) }))
  app.route("/", createApi({ db, config }))
  mountSpa(app, config.staticDir)

  serve({ fetch: app.fetch, port: config.port }, (info) => {
    console.log(`centime écoute sur http://localhost:${info.port}`)
  })
}

start().catch((error: unknown) => {
  if (error instanceof ConfigError) {
    console.error(`Configuration invalide : ${error.message}`)
  } else {
    console.error(error)
  }
  process.exit(1)
})
