import { fileURLToPath } from "node:url"
import { runMigrations } from "./migrations"
import { createDb, loadEnvFile, resolveDatabaseUrl } from "./node"

const projectRoot = fileURLToPath(new URL("../../../", import.meta.url))

loadEnvFile(`${projectRoot}.env`)

const databaseUrl = resolveDatabaseUrl(process.env.DATABASE_URL ?? "file:./data/centime.db", projectRoot)
await runMigrations(createDb(databaseUrl))
console.log(`Migrations appliquées sur ${databaseUrl}`)
