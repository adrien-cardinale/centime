import { compileRules } from "@centime/core"
import { isNotNull } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "bun:test"
import type { Db } from "./client"
import { DEFAULT_CATEGORIES, seedDefaultCategories } from "./default-categories"
import { DEFAULT_RULES, seedDefaultRules } from "./default-rules"
import { runMigrations } from "./migrations"
import { createDb } from "./node"
import { categories, rules } from "./schema"

let db: Db

beforeEach(async () => {
  db = createDb(":memory:")
  await runMigrations(db)
})

describe("default seeds", () => {
  it("seeds categories idempotently", async () => {
    await seedDefaultCategories(db)
    await seedDefaultCategories(db)
    expect(await db.select().from(categories)).toHaveLength(DEFAULT_CATEGORIES.length)
  })

  it("seeds rules idempotently", async () => {
    await seedDefaultCategories(db)
    await seedDefaultRules(db)
    await seedDefaultRules(db)
    expect(await db.select().from(rules)).toHaveLength(DEFAULT_RULES.length)
  })

  it("only references seeded categories", async () => {
    await seedDefaultCategories(db)
    await seedDefaultRules(db)
    const categoryIds = new Set(DEFAULT_CATEGORIES.map((category) => category.id))
    const linked = await db.select({ categoryId: rules.categoryId }).from(rules).where(isNotNull(rules.categoryId))
    expect(linked.every((rule) => rule.categoryId !== null && categoryIds.has(rule.categoryId))).toBe(true)
  })

  it("only contains compilable patterns", async () => {
    await seedDefaultCategories(db)
    await seedDefaultRules(db)
    const stored = await db.select().from(rules)
    expect(compileRules(stored).invalid).toEqual([])
  })

  it("stamps seeded rows with a fixed timestamp", async () => {
    const timestamp = "2000-01-01T00:00:00.000Z"
    await seedDefaultCategories(db, { timestamp })
    await seedDefaultRules(db, { timestamp })
    const stamped = [...(await db.select().from(categories)), ...(await db.select().from(rules))]
    expect(stamped.every((row) => row.createdAt === timestamp && row.updatedAt === timestamp)).toBe(true)
  })
})
