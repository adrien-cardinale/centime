import { isoDateOf } from "@centime/core"
import type { Db } from "@centime/db"
import { Hono } from "hono"
import { z } from "zod"
import { dashboardOverview } from "../services/dashboard"
import type { Clock } from "./fixed-items"
import { validated } from "./validation"

const querySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide (AAAA-MM-JJ)")
    .optional(),
})

export function createDashboardRoutes(db: Db, clock: Clock = () => new Date()) {
  return new Hono().get("/", validated("query", querySchema), async (c) => {
    const today = isoDateOf(clock())
    const date = c.req.valid("query").date ?? today
    return c.json(await dashboardOverview(db, date, today), 200)
  })
}
