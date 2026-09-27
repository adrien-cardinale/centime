import { defaultOverviewRange, fixedItemPayloadSchema, isoDateOf } from "@centime/core"
import type { Db } from "@centime/db"
import { Hono } from "hono"
import { z } from "zod"
import {
  createFixedItem,
  deleteFixedItem,
  findFixedItem,
  fixedItemsOverview,
  isActiveCategory,
  listFixedItems,
  listLinkedTransactions,
  updateFixedItem,
} from "../services/fixed-items"
import { validated } from "./validation"

export type Clock = () => Date

const idParamSchema = z.object({ id: z.string().min(1) })
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide (AAAA-MM-JJ)")

const overviewQuerySchema = z.object({ from: isoDate.optional(), to: isoDate.optional() })

const NOT_FOUND = "Poste fixe introuvable"
const INVALID_RANGE = "La date de début doit précéder la date de fin"
const UNKNOWN_CATEGORY = "Catégorie introuvable"

export function createFixedItemRoutes(db: Db, clock: Clock = () => new Date()) {
  return new Hono()
    .get("/", async (c) => c.json(await listFixedItems(db), 200))
    .get("/overview", validated("query", overviewQuerySchema), async (c) => {
      const query = c.req.valid("query")
      const today = isoDateOf(clock())
      const defaults = defaultOverviewRange(today)
      const range = { from: query.from ?? defaults.from, to: query.to ?? defaults.to }
      if (range.from > range.to) return c.json({ error: INVALID_RANGE }, 400)
      return c.json(await fixedItemsOverview(db, range, today), 200)
    })
    .get("/:id/transactions", validated("param", idParamSchema), async (c) => {
      const { id } = c.req.valid("param")
      if (!(await findFixedItem(db, id))) return c.json({ error: NOT_FOUND }, 404)
      return c.json(await listLinkedTransactions(db, id), 200)
    })
    .post("/", validated("json", fixedItemPayloadSchema), async (c) => {
      const payload = c.req.valid("json")
      if (!(await isActiveCategory(db, payload.categoryId))) return c.json({ error: UNKNOWN_CATEGORY }, 400)
      const created = await findFixedItem(db, await createFixedItem(db, payload))
      if (!created) throw new Error("Poste fixe créé introuvable")
      return c.json(created, 201)
    })
    .put("/:id", validated("param", idParamSchema), validated("json", fixedItemPayloadSchema), async (c) => {
      const { id } = c.req.valid("param")
      const payload = c.req.valid("json")
      if (!(await isActiveCategory(db, payload.categoryId))) return c.json({ error: UNKNOWN_CATEGORY }, 400)
      if (!(await updateFixedItem(db, id, payload))) return c.json({ error: NOT_FOUND }, 404)
      const updated = await findFixedItem(db, id)
      if (!updated) return c.json({ error: NOT_FOUND }, 404)
      return c.json(updated, 200)
    })
    .delete("/:id", validated("param", idParamSchema), async (c) => {
      const { id } = c.req.valid("param")
      if (!(await deleteFixedItem(db, id))) return c.json({ error: NOT_FOUND }, 404)
      return c.json({ id }, 200)
    })
}
