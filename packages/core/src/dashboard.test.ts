import { describe, expect, it } from "vitest"
import { periodContaining } from "./budgets"
import { balanceSeries, type BreakdownEntry, latestBalance, lastMonths, limitBreakdown } from "./dashboard"

function category(id: string, amount: number): BreakdownEntry {
  return { categoryId: id, name: id, color: "#4a84c4", amount, kind: "category" }
}

describe("lastMonths", () => {
  it("returns the given number of months ending with the reference, oldest first", () => {
    const months = lastMonths(periodContaining("monthly", "2026-02-14"), 12)
    expect(months).toHaveLength(12)
    expect(months[0]?.start).toBe("2025-03-01")
    expect(months[11]).toMatchObject({ start: "2026-02-01", end: "2026-02-28" })
  })
})

describe("limitBreakdown", () => {
  it("keeps the largest entries and groups the rest under Autres", () => {
    const entries = Array.from({ length: 10 }, (_, index) => category(`c${index}`, (index + 1) * 10))
    const limited = limitBreakdown(entries)
    expect(limited).toHaveLength(8)
    expect(limited.slice(0, 7).map((entry) => entry.categoryId)).toEqual(["c9", "c8", "c7", "c6", "c5", "c4", "c3"])
    expect(limited[7]).toEqual({ categoryId: null, name: "Autres", color: null, amount: 60, kind: "other" })
  })

  it("omits Autres when everything fits and drops empty entries", () => {
    expect(limitBreakdown([category("a", 5), category("b", 0)])).toEqual([category("a", 5)])
  })
})

describe("balanceSeries", () => {
  const points = [
    { accountId: "a", bookingDate: "2026-01-10", balance: 1000 },
    { accountId: "a", bookingDate: "2026-01-25", balance: 900 },
    { accountId: "b", bookingDate: "2026-02-05", balance: 200 },
    { accountId: "a", bookingDate: "2026-03-02", balance: 1200 },
  ]

  it("sums the last known balance of each account at the end of each month", () => {
    const months = lastMonths(periodContaining("monthly", "2026-03-15"), 4)
    expect(balanceSeries(points, months).map(({ range, balance }) => [range.start, balance])).toEqual([
      ["2026-01-01", 900],
      ["2026-02-01", 1100],
      ["2026-03-01", 1400],
    ])
  })

  it("returns the latest balance or null without data", () => {
    expect(latestBalance(points)).toBe(1400)
    expect(latestBalance([])).toBeNull()
  })
})
