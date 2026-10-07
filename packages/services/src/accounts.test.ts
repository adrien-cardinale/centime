import type { Db } from "@centime/db"
import { beforeEach, describe, expect, it } from "bun:test"
import { createAccount } from "./accounts"
import { ServiceError } from "./errors"
import { createTestDb } from "./test-support/database"

const INPUT = { name: "Courant", kind: "bank", currency: "CHF" } as const

let db: Db

beforeEach(async () => {
  db = await createTestDb()
})

describe("createAccount", () => {
  it("stores the identifier in normalized form", async () => {
    const created = await createAccount(db, { ...INPUT, identifier: "ch93 0076 2011 6238 5295 7" })
    expect(created.identifier).toBe("CH9300762011623852957")
  })

  it("rejects a duplicate identifier spelled differently", async () => {
    await createAccount(db, { ...INPUT, identifier: "CH9300762011623852957" })
    const duplicate = createAccount(db, { ...INPUT, name: "Doublon", identifier: "CH93 0076 2011 6238 5295 7" })
    await expect(duplicate).rejects.toBeInstanceOf(ServiceError)
  })
})
