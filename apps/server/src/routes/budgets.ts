import { budgetPayloadSchema, isoDateOf } from "@centime/core"
import type { Db } from "@centime/db"
import { Hono } from "hono"
import { z } from "zod"
import {
  budgetsOverview,
  categoryExists,
  categoryHasBudget,
  createBudget,
  deleteBudget,
  findBudget,
  listBudgets,
  updateBudget,
} from "../services/budgets"
import type { Clock } from "./fixed-items"
import { validated } from "./validation"

const idParamSchema = z.object({ id: z.string().min(1) })
const overviewQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide (AAAA-MM-JJ)")
    .optional(),
})

const NOT_FOUND = "Budget introuvable"
const UNKNOWN_CATEGORY = "Catégorie introuvable"
const DUPLICATE_BUDGET = "Cette catégorie a déjà un budget"

export function createBudgetRoutes(db: Db, clock: Clock = () => new Date()) {
  return new Hono()
    .get("/", async (c) => c.json(await listBudgets(db), 200))
    .get("/overview", validated("query", overviewQuerySchema), async (c) => {
      const today = isoDateOf(clock())
      const date = c.req.valid("query").date ?? today
      return c.json(await budgetsOverview(db, date, today), 200)
    })
    .post("/", validated("json", budgetPayloadSchema), async (c) => {
      const payload = c.req.valid("json")
      if (!(await categoryExists(db, payload.categoryId))) return c.json({ error: UNKNOWN_CATEGORY }, 404)
      if (await categoryHasBudget(db, payload.categoryId)) return c.json({ error: DUPLICATE_BUDGET }, 409)
      const created = await findBudget(db, await createBudget(db, payload))
      if (!created) throw new Error("Budget créé introuvable")
      return c.json(created, 201)
    })
    .put("/:id", validated("param", idParamSchema), validated("json", budgetPayloadSchema), async (c) => {
      const { id } = c.req.valid("param")
      const payload = c.req.valid("json")
      if (!(await categoryExists(db, payload.categoryId))) return c.json({ error: UNKNOWN_CATEGORY }, 404)
      if (await categoryHasBudget(db, payload.categoryId, id)) return c.json({ error: DUPLICATE_BUDGET }, 409)
      if (!(await updateBudget(db, id, payload))) return c.json({ error: NOT_FOUND }, 404)
      const updated = await findBudget(db, id)
      if (!updated) return c.json({ error: NOT_FOUND }, 404)
      return c.json(updated, 200)
    })
    .delete("/:id", validated("param", idParamSchema), async (c) => {
      const { id } = c.req.valid("param")
      if (!(await deleteBudget(db, id))) return c.json({ error: NOT_FOUND }, 404)
      return c.json({ id }, 200)
    })
}
