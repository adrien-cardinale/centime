import { budgetPayloadSchema } from "@centime/core"
import type { Db } from "@centime/db"
import {
  type Clock,
  createBudget,
  deleteBudget,
  getBudgetsOverview,
  listBudgets,
  systemClock,
  updateBudget,
} from "@centime/services"
import { Hono } from "hono"
import { z } from "zod"
import { idParamSchema, isoDateParam, validated } from "./validation"

const overviewQuerySchema = z.object({ date: isoDateParam.optional() })

export function createBudgetRoutes(db: Db, clock: Clock = systemClock) {
  return new Hono()
    .get("/", async (c) => c.json(await listBudgets(db), 200))
    .get("/overview", validated("query", overviewQuerySchema), async (c) =>
      c.json(await getBudgetsOverview(db, c.req.valid("query"), clock), 200),
    )
    .post("/", validated("json", budgetPayloadSchema), async (c) => c.json(await createBudget(db, c.req.valid("json")), 201))
    .put("/:id", validated("param", idParamSchema), validated("json", budgetPayloadSchema), async (c) => {
      const budget = await updateBudget(db, { ...c.req.valid("json"), id: c.req.valid("param").id })
      return c.json(budget, 200)
    })
    .delete("/:id", validated("param", idParamSchema), async (c) =>
      c.json(await deleteBudget(db, c.req.valid("param"), clock), 200),
    )
}
