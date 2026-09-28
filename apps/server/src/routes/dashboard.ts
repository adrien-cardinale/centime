import type { Db } from "@centime/db"
import { type Clock, getDashboard, systemClock } from "@centime/services"
import { Hono } from "hono"
import { z } from "zod"
import { isoDateParam, validated } from "./validation"

const querySchema = z.object({ date: isoDateParam.optional() })

export function createDashboardRoutes(db: Db, clock: Clock = systemClock) {
  return new Hono().get("/", validated("query", querySchema), async (c) =>
    c.json(await getDashboard(db, c.req.valid("query"), clock), 200),
  )
}
