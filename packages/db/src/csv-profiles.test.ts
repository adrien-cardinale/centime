import { DEFAULT_CSV_PROFILES, RAIFFEISEN_CSV_PROFILE } from "@centime/core"
import { beforeEach, describe, expect, it } from "vitest"
import { createDb, runMigrations, type Db } from "./client"
import { csvProfileFromRow, seedDefaultCsvProfiles } from "./csv-profiles"
import { csvProfiles } from "./schema"

let db: Db

beforeEach(async () => {
  db = createDb(":memory:")
  await runMigrations(db)
})

describe("seedDefaultCsvProfiles", () => {
  it("is idempotent", async () => {
    await seedDefaultCsvProfiles(db)
    await seedDefaultCsvProfiles(db)
    const rows = await db.select().from(csvProfiles)
    expect(rows).toHaveLength(DEFAULT_CSV_PROFILES.length)
  })

  it("stores profiles that read back identically", async () => {
    await seedDefaultCsvProfiles(db)
    const stored = (await db.select().from(csvProfiles)).find((candidate) => candidate.id === RAIFFEISEN_CSV_PROFILE.id)
    expect(stored && csvProfileFromRow(stored)).toEqual(RAIFFEISEN_CSV_PROFILE)
  })
})

describe("csvProfileFromRow", () => {
  it("returns null for an invalid configuration", () => {
    expect(csvProfileFromRow({ id: "x", name: "Cassé", config: "{\"encoding\":\"utf-16\"}" })).toBeNull()
  })
})
