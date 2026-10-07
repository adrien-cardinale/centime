import { themeInputSchema } from "@centime/core"
import type { Db } from "@centime/db"
import { createTheme, deleteTheme, listThemes, updateTheme } from "@centime/services"
import { Hono } from "hono"
import { idParamSchema, validated } from "./validation"

export function createThemeRoutes(db: Db) {
  return new Hono()
    .get("/", async (c) => c.json(await listThemes(db), 200))
    .post("/", validated("json", themeInputSchema), async (c) => c.json(await createTheme(db, c.req.valid("json")), 201))
    .put("/:id", validated("param", idParamSchema), validated("json", themeInputSchema), async (c) => {
      const theme = await updateTheme(db, { ...c.req.valid("json"), id: c.req.valid("param").id })
      return c.json(theme, 200)
    })
    .delete("/:id", validated("param", idParamSchema), async (c) => c.json(await deleteTheme(db, c.req.valid("param")), 200))
}
