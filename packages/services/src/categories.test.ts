import { CATEGORY_COLOR_PALETTE } from "@centime/core"
import type { Db } from "@centime/db"
import { beforeEach, describe, expect, it } from "bun:test"
import { createCategory, updateCategory } from "./categories"
import { createTestDb } from "./test-support/database"

let db: Db

beforeEach(async () => {
  db = await createTestDb()
})

describe("createCategory without a color", () => {
  it("rotates through the palette, starting with its first color", async () => {
    const first = await createCategory(db, { name: "Courses" })
    const second = await createCategory(db, { name: "Loisirs" })

    expect(first.color).toBe(CATEGORY_COLOR_PALETTE[0])
    expect(second.color).toBe(CATEGORY_COLOR_PALETTE[1])
  })

  it("keeps an explicit color", async () => {
    const created = await createCategory(db, { name: "Santé", color: "#cc6666" })

    expect(created.color).toBe("#cc6666")
  })
})

describe("updateCategory without a color", () => {
  it("keeps the existing color", async () => {
    const created = await createCategory(db, { name: "Santé", color: "#cc6666" })

    const updated = await updateCategory(db, { id: created.id, name: "Soins" })

    expect(updated.color).toBe("#cc6666")
    expect(updated.name).toBe("Soins")
  })
})
