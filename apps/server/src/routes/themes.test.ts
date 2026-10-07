import { categories, type Db, themes } from "@centime/db"
import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "bun:test"
import { createTestDb, withErrorHandling } from "../test-support/database"
import { createThemeRoutes } from "./themes"

let db: Db

function json(method: string, body: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
}

async function insertTheme(name: string): Promise<string> {
  const [row] = await db.insert(themes).values({ name, color: "#4a84c4" }).returning({ id: themes.id })
  if (!row) throw new Error("Thème de test impossible à créer")
  return row.id
}

beforeEach(async () => {
  db = await createTestDb()
})

describe("theme routes", () => {
  it("creates, lists with the category count and updates a theme", async () => {
    const routes = withErrorHandling(createThemeRoutes(db))
    const created = await routes.request("/", json("POST", { name: "Maison", color: "#4A84C4" }))
    expect(created.status).toBe(201)
    const { id } = (await created.json()) as { id: string }
    await db.insert(categories).values({ name: "Énergie", color: "#4a84c4", themeId: id })

    expect(await (await routes.request("/")).json()).toMatchObject([{ id, name: "Maison", color: "#4a84c4", categoryCount: 1 }])
    const updated = await routes.request(`/${id}`, json("PUT", { name: "Foyer", color: "#4a84c4" }))
    expect(await updated.json()).toMatchObject({ id, name: "Foyer" })
  })

  it("soft deletes a theme and keeps its categories without theme", async () => {
    const id = await insertTheme("Maison")
    const [category] = await db.insert(categories).values({ name: "Énergie", color: "#4a84c4", themeId: id }).returning()

    const response = await withErrorHandling(createThemeRoutes(db)).request(`/${id}`, { method: "DELETE" })
    expect(response.status).toBe(200)

    expect((await db.query.themes.findFirst({ where: eq(themes.id, id) }))?.deletedAt).not.toBeNull()
    const stored = await db.query.categories.findFirst({ where: eq(categories.id, category?.id ?? "") })
    expect(stored).toMatchObject({ themeId: null, deletedAt: null })
  })

  it("returns 404 when deleting twice", async () => {
    const id = await insertTheme("Temporaire")
    const routes = withErrorHandling(createThemeRoutes(db))
    await routes.request(`/${id}`, { method: "DELETE" })
    expect((await routes.request(`/${id}`, { method: "DELETE" })).status).toBe(404)
  })
})
