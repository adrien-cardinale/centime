import { fileURLToPath } from "node:url"
import { createDb, runMigrations } from "./client"
import { resolveDatabaseUrl } from "./database-url"

const projectRoot = fileURLToPath(new URL("../../../", import.meta.url))

try {
  process.loadEnvFile(`${projectRoot}.env`)
} catch {}

const databaseUrl = resolveDatabaseUrl(process.env.DATABASE_URL ?? "file:./data/centime.db", projectRoot)
await runMigrations(createDb(databaseUrl))
console.log(`Migrations appliquées sur ${databaseUrl}`)
