import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core"
import { drizzle } from "drizzle-orm/sqlite-proxy"
import * as schema from "./schema"

export type Db = BaseSQLiteDatabase<"async", unknown, typeof schema>
export type DbExecutor = Db

export type ProxyMethod = "run" | "all" | "values" | "get"

export type ProxyExecutor = (
  sql: string,
  params: unknown[],
  method: ProxyMethod,
) => Promise<{ rows: unknown[] | unknown[][] }>

type DriverResult = { rows: unknown[] }

async function executeForDriver(
  execute: ProxyExecutor,
  sql: string,
  params: unknown[],
  method: ProxyMethod,
): Promise<DriverResult> {
  const { rows } = await execute(sql, params, method)
  if (method === "get" && rows.length === 0) {
    // drizzle's proxy driver only treats an undefined row as "no result" for get queries
    return { rows: undefined } as unknown as DriverResult
  }
  return { rows }
}

export function createProxyDb(execute: ProxyExecutor): Db {
  return drizzle((sql, params, method) => executeForDriver(execute, sql, params, method), { schema })
}
