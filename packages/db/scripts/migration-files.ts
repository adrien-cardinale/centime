import { readFileSync } from "node:fs"
import { join } from "node:path"
import type { Migration } from "../src/migrations"

type Journal = { entries: { tag: string; when: number }[] }

export function readMigrationFolder(folder: string): Migration[] {
  const journal = JSON.parse(readFileSync(join(folder, "meta", "_journal.json"), "utf8")) as Journal
  return journal.entries.map(({ tag, when }) => ({
    tag,
    when,
    sql: readFileSync(join(folder, `${tag}.sql`), "utf8"),
  }))
}

function renderEntry(migration: Migration): string {
  return [
    "  {",
    `    tag: ${JSON.stringify(migration.tag)},`,
    `    when: ${migration.when},`,
    `    sql: ${JSON.stringify(migration.sql)},`,
    "  },",
  ].join("\n")
}

export function renderMigrationsModule(migrations: Migration[]): string {
  return [
    'import type { Migration } from "./migrations"',
    "",
    "export const GENERATED_MIGRATIONS: readonly Migration[] = [",
    ...migrations.map(renderEntry),
    "]",
    "",
  ].join("\n")
}
