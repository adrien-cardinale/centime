import { csvProfileSchema } from "@centime/core"
import type { Db } from "@centime/db"
import { createCsvProfile, deleteCsvProfile, listCsvProfiles, updateCsvProfile } from "@centime/services"
import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import { idParamSchema } from "./validation"

export function createCsvProfileRoutes(db: Db) {
  return new Hono()
    .get("/", async (c) => c.json(await listCsvProfiles(db), 200))
    .post("/", zValidator("json", csvProfileSchema), async (c) => c.json(await createCsvProfile(db, c.req.valid("json")), 201))
    .put("/:id", zValidator("param", idParamSchema), zValidator("json", csvProfileSchema), async (c) => {
      const profile = await updateCsvProfile(db, { ...c.req.valid("json"), id: c.req.valid("param").id })
      return c.json(profile, 200)
    })
    .delete("/:id", zValidator("param", idParamSchema), async (c) =>
      c.json(await deleteCsvProfile(db, c.req.valid("param")), 200),
    )
}
