import type { ProxyExecutor, ProxyMethod } from "@centime/db"
import type { Database, SqlValue } from "sql.js"

export type StatementListener = (sql: string, method: ProxyMethod) => void

const READ_ONLY_STATEMENT = /^\s*(select|pragma)\b/i

export function isWriteStatement(sql: string): boolean {
  return !READ_ONLY_STATEMENT.test(sql)
}

function toSqlValue(value: unknown): SqlValue {
  if (value === undefined || value === null) return null
  if (typeof value === "boolean") return value ? 1 : 0
  if (typeof value === "bigint") return Number(value)
  if (typeof value === "number" || typeof value === "string" || value instanceof Uint8Array) return value
  return JSON.stringify(value)
}

const textDecoder = new TextDecoder()

function fromSqlValue(value: unknown): unknown {
  if (typeof value === "bigint") return Number(value)
  if (value instanceof Uint8Array) return textDecoder.decode(value)
  return value
}

function selectRows(database: Database, sql: string, params: SqlValue[]): unknown[][] {
  const statement = database.prepare(sql)
  try {
    statement.bind(params)
    const rows: unknown[][] = []
    while (statement.step()) rows.push(statement.get().map(fromSqlValue))
    return rows
  } finally {
    statement.free()
  }
}

export function createSqlJsExecutor(database: Database, onStatement?: StatementListener): ProxyExecutor {
  return async (sql, params, method) => {
    const values = params.map(toSqlValue)
    if (method === "run") {
      database.run(sql, values)
      onStatement?.(sql, method)
      return { rows: [] }
    }
    const rows = selectRows(database, sql, values)
    onStatement?.(sql, method)
    if (method === "get") return { rows: rows[0] ?? [] }
    return { rows }
  }
}

export function applyConnectionPragmas(database: Database): void {
  database.run("PRAGMA foreign_keys = OFF")
  database.run("PRAGMA journal_mode = MEMORY")
}
