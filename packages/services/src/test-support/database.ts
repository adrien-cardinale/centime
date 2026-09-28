import { accounts, type Db, runMigrations } from "@centime/db"
import { createDb } from "@centime/db/node"

export async function createTestDb(): Promise<Db> {
  const db = createDb(":memory:")
  await runMigrations(db)
  return db
}

export async function createTestAccount(db: Db, identifier = "CH0000000000000000000"): Promise<string> {
  const [account] = await db
    .insert(accounts)
    .values({ name: "Compte test", kind: "bank", identifier })
    .returning({ id: accounts.id })
  if (!account) throw new Error("Compte de test impossible à créer")
  return account.id
}
