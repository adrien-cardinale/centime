import type { ThemeInput } from "@centime/core"
import { categories, type Db, themes } from "@centime/db"
import { and, count, eq, isNull } from "drizzle-orm"
import { type Clock, nowIso, systemClock } from "./clock"
import { notFound } from "./errors"

export type ThemeUpdate = ThemeInput & { id: string }

const NOT_FOUND = "Thème introuvable"

function activeTheme(id: string) {
  return and(eq(themes.id, id), isNull(themes.deletedAt))
}

function toRow(input: ThemeInput) {
  return { name: input.name, color: input.color, icon: input.icon ?? null }
}

export async function listThemes(db: Db) {
  const rows = await db
    .select({
      id: themes.id,
      name: themes.name,
      color: themes.color,
      icon: themes.icon,
      categoryCount: count(categories.id),
    })
    .from(themes)
    .leftJoin(categories, and(eq(categories.themeId, themes.id), isNull(categories.deletedAt)))
    .where(isNull(themes.deletedAt))
    .groupBy(themes.id)
  return rows.sort((left, right) => left.name.localeCompare(right.name, "fr"))
}

export async function createTheme(db: Db, input: ThemeInput) {
  const [created] = await db.insert(themes).values(toRow(input)).returning()
  if (!created) throw new Error("Insertion du thème impossible")
  return created
}

export async function updateTheme(db: Db, { id, ...input }: ThemeUpdate) {
  const [updated] = await db.update(themes).set(toRow(input)).where(activeTheme(id)).returning()
  if (!updated) throw notFound(NOT_FOUND)
  return updated
}

export async function deleteTheme(db: Db, { id }: { id: string }, clock: Clock = systemClock) {
  const deleted = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(themes)
      .set({ deletedAt: nowIso(clock) })
      .where(activeTheme(id))
      .returning({ id: themes.id })
    if (row) await tx.update(categories).set({ themeId: null }).where(eq(categories.themeId, id))
    return row !== undefined
  })
  if (!deleted) throw notFound(NOT_FOUND)
  return { id }
}
