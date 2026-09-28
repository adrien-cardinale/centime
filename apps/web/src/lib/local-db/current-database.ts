import type { LocalDatabase } from "./open-local-db"

let current: LocalDatabase | null = null

export function setLocalDatabase(database: LocalDatabase): void {
  current = database
}

export function getLocalDatabase(): LocalDatabase {
  if (!current) throw new Error("Base locale non ouverte")
  return current
}
