import { compileRules } from "@centime/core"
import { isNotNull } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"
import { createDb, type Db, runMigrations } from "./client"
import { DEFAULT_CATEGORIES, seedDefaultCategories } from "./default-categories"
import { DEFAULT_RULES, seedDefaultRules } from "./default-rules"
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
})
