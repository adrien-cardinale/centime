import { ACCOUNT_KINDS, normalizeAccountIdentifier } from "@centime/core"
import { accounts, type Db } from "@centime/db"
import { asc, isNull } from "drizzle-orm"
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
  // L'identifiant est stocké normalisé : c'est la clé de rapprochement des imports et la clé d'unicité de la sync.
  const identifier = normalizeAccountIdentifier(input.identifier)
  const rows = await db.select({ identifier: accounts.identifier }).from(accounts)
  if (rows.some((row) => normalizeAccountIdentifier(row.identifier) === identifier)) {
    throw new ServiceError("Un compte avec cet identifiant existe déjà", 409)
  }
  const [created] = await db.insert(accounts).values({ ...input, identifier }).returning()
  if (!created) throw new Error("Insertion du compte impossible")
  return created
}
