import { BANK_TEST_PROFILE, TEST_CSV_PROFILES } from "@centime/core/test-fixtures"
import { beforeEach, describe, expect, it } from "bun:test"
import type { Db } from "./client"
import { csvProfileFromRow, csvProfileToRow } from "./csv-profiles"
import { runMigrations } from "./migrations"
import { createDb } from "./node"
import { csvProfiles } from "./schema"

let db: Db

beforeEach(async () => {
  db = createDb(":memory:")
  await runMigrations(db)
})

describe("csvProfileToRow", () => {
  it("stores profiles that read back identically", async () => {
    await db.insert(csvProfiles).values(TEST_CSV_PROFILES.map((profile) => ({ id: profile.id, ...csvProfileToRow(profile) })))
    const stored = (await db.select().from(csvProfiles)).find((candidate) => candidate.id === BANK_TEST_PROFILE.id)
    expect(stored && csvProfileFromRow(stored)).toEqual(BANK_TEST_PROFILE)
  })
})

describe("csvProfileFromRow", () => {
  it("returns null for an invalid configuration", () => {
    expect(csvProfileFromRow({ id: "x", name: "Cassé", config: "{\"encoding\":\"utf-16\"}" })).toBeNull()
  })
})
