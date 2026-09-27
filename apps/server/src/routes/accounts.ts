import { ACCOUNT_KINDS } from "@centime/core"
import { accounts, type Db } from "@centime/db"
import { zValidator } from "@hono/zod-validator"
import { asc, eq, isNull } from "drizzle-orm"
import { Hono } from "hono"
import { z } from "zod"

const createAccountSchema = z.object({
  name: z.string().trim().min(1),
  kind: z.enum(ACCOUNT_KINDS),
  identifier: z.string().trim().min(1),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/)
    .default("CHF"),
})

export function createAccountRoutes(db: Db) {
  return new Hono()
    .get("/", async (c) => {
      const rows = await db.select().from(accounts).where(isNull(accounts.deletedAt)).orderBy(asc(accounts.name))
      return c.json(rows, 200)
    })
    .post("/", zValidator("json", createAccountSchema), async (c) => {
      const input = c.req.valid("json")
      const existing = await db.query.accounts.findFirst({ where: eq(accounts.identifier, input.identifier) })
      if (existing) {
        return c.json({ error: "Un compte avec cet identifiant existe déjà" }, 409)
      }
      const [created] = await db.insert(accounts).values(input).returning()
      if (!created) throw new Error("Insertion du compte impossible")
      return c.json(created, 201)
    })
}
