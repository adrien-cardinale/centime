import { describe, expect, it } from "bun:test"
import { SYNC_ROW_SCHEMAS } from "./sync-schemas"

const STAMP = "2026-01-01T00:00:00.000Z"

const legacyRule = {
  id: "0b6f1a52-3c1e-4d8e-9a4f-2f6d1c7e8a90",
  createdAt: STAMP,
  updatedAt: STAMP,
  deletedAt: null,
  syncVersion: 3,
  pattern: "Coop",
  matchKind: "contains",
  field: "raw_label",
  categoryId: null,
  markAsTransfer: true,
  priority: 0,
}

describe("rules sync schema", () => {
  it("reads a rule pushed before budgets owned rules", () => {
    expect(SYNC_ROW_SCHEMAS.rules.parse(legacyRule).budgetId).toBeNull()
  })

  it("keeps the owning budget", () => {
    const budgetId = "5d2c9e7a-1b3f-4a6e-8c0d-9e8f7a6b5c4d"
    expect(SYNC_ROW_SCHEMAS.rules.parse({ ...legacyRule, budgetId }).budgetId).toBe(budgetId)
  })
})
