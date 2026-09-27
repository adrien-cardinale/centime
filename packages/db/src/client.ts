import { createClient, type ResultSet } from "@libsql/client"
import { drizzle } from "drizzle-orm/libsql"
import { migrate } from "drizzle-orm/libsql/migrator"
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core"
import { fileURLToPath } from "node:url"
import * as schema from "./schema"

export const defaultMigrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url))

export function createDb(url: string) {
  const client = createClient({ url })
  return drizzle(client, { schema })
}

export type Db = ReturnType<typeof createDb>
export type DbExecutor = BaseSQLiteDatabase<"async", ResultSet, typeof schema>

export async function runMigrations(db: Db, migrationsFolder: string = defaultMigrationsFolder): Promise<void> {
  await migrate(db, { migrationsFolder })
}
