import type { Db } from "@centime/db"
import { accountInputSchema, createAccount, listAccounts } from "@centime/services"
import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"

export function createAccountRoutes(db: Db) {
  return new Hono()
    .get("/", async (c) => c.json(await listAccounts(db), 200))
    .post("/", zValidator("json", accountInputSchema), async (c) => c.json(await createAccount(db, c.req.valid("json")), 201))
}
