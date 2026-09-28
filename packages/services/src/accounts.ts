import { ACCOUNT_KINDS } from "@centime/core"
import { accounts, type Db } from "@centime/db"
import { asc, eq, isNull } from "drizzle-orm"
import { z } from "zod"
import { ServiceError } from "./errors"

export const accountInputSchema = z.object({
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

export type AccountInput = z.output<typeof accountInputSchema>

export function listAccounts(db: Db) {
  return db.select().from(accounts).where(isNull(accounts.deletedAt)).orderBy(asc(accounts.name))
}

export async function createAccount(db: Db, input: AccountInput) {
  const existing = await db.query.accounts.findFirst({ where: eq(accounts.identifier, input.identifier) })
  if (existing) throw new ServiceError("Un compte avec cet identifiant existe déjà", 409)
  const [created] = await db.insert(accounts).values(input).returning()
  if (!created) throw new Error("Insertion du compte impossible")
  return created
}
