import { createClient } from "@libsql/client"
import { drizzle } from "drizzle-orm/libsql"
import type { Db } from "./client"
import * as schema from "./schema"

export { resolveDatabaseUrl } from "./database-url"
export { loadEnvFile } from "./env-file"

export function createDb(url: string): Db {
  return drizzle(createClient({ url }), { schema })
}
