import { type Db, SYNC_TABLE_NAMES } from "@centime/db"
import { DEFAULT_PULL_LIMIT, pullChanges, pushChanges } from "@centime/services"
import { Hono } from "hono"
import { z } from "zod"
import { validated } from "./validation"

const pullQuerySchema = z.object({ since: z.coerce.number().int().min(0).default(0) })

const pushSchema = z.strictObject({
  changes: z.partialRecord(z.enum(SYNC_TABLE_NAMES), z.array(z.unknown())),
})

export type SyncRouteOptions = { pullLimit?: number }

export function createSyncRoutes(db: Db, { pullLimit = DEFAULT_PULL_LIMIT }: SyncRouteOptions = {}) {
  return new Hono()
    .get("/pull", validated("query", pullQuerySchema), async (c) =>
      c.json(await pullChanges(db, { since: c.req.valid("query").since, limit: pullLimit }), 200),
    )
    .post("/push", validated("json", pushSchema), async (c) => c.json(await pushChanges(db, c.req.valid("json")), 200))
}
