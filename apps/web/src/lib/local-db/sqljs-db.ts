import initSqlJs, { type Database } from "sql.js"
import wasmUrl from "sql.js/dist/sql-wasm-browser.wasm?url"
import { applyConnectionPragmas } from "./sqljs-executor"

export async function openSqlJsDatabase(bytes: Uint8Array | null): Promise<Database> {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl })
  const database = bytes ? new SQL.Database(bytes) : new SQL.Database()
  applyConnectionPragmas(database)
  return database
}
