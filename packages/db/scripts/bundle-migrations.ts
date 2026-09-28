import { writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { readMigrationFolder, renderMigrationsModule } from "./migration-files"

const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url))
const outputFile = fileURLToPath(new URL("../src/migrations.generated.ts", import.meta.url))

const migrations = readMigrationFolder(migrationsFolder)
writeFileSync(outputFile, renderMigrationsModule(migrations))
console.log(`${migrations.length} migrations regroupées dans ${outputFile}`)
