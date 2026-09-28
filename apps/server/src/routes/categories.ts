import { categoryInputSchema } from "@centime/core"
import type { Db } from "@centime/db"
import { createCategory, deleteCategory, listCategories, updateCategory } from "@centime/services"
import { Hono } from "hono"
import { idParamSchema, validated } from "./validation"

export function createCategoryRoutes(db: Db) {
  return new Hono()
    .get("/", async (c) => c.json(await listCategories(db), 200))
    .post("/", validated("json", categoryInputSchema), async (c) => c.json(await createCategory(db, c.req.valid("json")), 201))
    .put("/:id", validated("param", idParamSchema), validated("json", categoryInputSchema), async (c) => {
      const category = await updateCategory(db, { ...c.req.valid("json"), id: c.req.valid("param").id })
      return c.json(category, 200)
    })
    .delete("/:id", validated("param", idParamSchema), async (c) => c.json(await deleteCategory(db, c.req.valid("param")), 200))
}
