import { fixedItemPayloadSchema } from "@centime/core"
import type { Db } from "@centime/db"
import {
  type Clock,
  createFixedItem,
  deleteFixedItem,
  getFixedItemsOverview,
  listFixedItems,
  listFixedItemTransactions,
  systemClock,
  updateFixedItem,
} from "@centime/services"
import { Hono } from "hono"
import { z } from "zod"
import { idParamSchema, isoDateParam, validated } from "./validation"

const overviewQuerySchema = z.object({ from: isoDateParam.optional(), to: isoDateParam.optional() })

export function createFixedItemRoutes(db: Db, clock: Clock = systemClock) {
  return new Hono()
    .get("/", async (c) => c.json(await listFixedItems(db), 200))
    .get("/overview", validated("query", overviewQuerySchema), async (c) =>
      c.json(await getFixedItemsOverview(db, c.req.valid("query"), clock), 200),
    )
    .get("/:id/transactions", validated("param", idParamSchema), async (c) =>
      c.json(await listFixedItemTransactions(db, c.req.valid("param")), 200),
    )
    .post("/", validated("json", fixedItemPayloadSchema), async (c) =>
      c.json(await createFixedItem(db, c.req.valid("json")), 201),
    )
    .put("/:id", validated("param", idParamSchema), validated("json", fixedItemPayloadSchema), async (c) => {
      const item = await updateFixedItem(db, { ...c.req.valid("json"), id: c.req.valid("param").id }, clock)
      return c.json(item, 200)
    })
    .delete("/:id", validated("param", idParamSchema), async (c) =>
      c.json(await deleteFixedItem(db, c.req.valid("param"), clock), 200),
    )
}
