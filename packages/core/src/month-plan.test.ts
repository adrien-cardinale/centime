import { describe, expect, it } from "bun:test"
import { monthlyBudgetAmount, monthPlanOf } from "./month-plan"

describe("monthlyBudgetAmount", () => {
  it("spreads a budget over the months of its period", () => {
    expect(monthlyBudgetAmount({ amount: 500, period: "monthly" })).toBe(500)
    expect(monthlyBudgetAmount({ amount: 600, period: "quarterly" })).toBe(200)
    expect(monthlyBudgetAmount({ amount: 1000, period: "yearly" })).toBe(83.33)
  })
})

describe("monthPlanOf", () => {
  it("subtracts the envelopes from the expected income", () => {
    const plan = monthPlanOf({ expected: 6200, actual: 6150 }, { expected: 1900, actual: 1120 })
    expect(plan.income).toEqual({ expected: 6200, actual: 6150 })
    expect(plan.envelopes).toEqual({ expected: 1900, actual: 1120 })
    expect(plan.remaining).toBe(4300)
  })

  it("goes negative when the month is over-allocated", () => {
    expect(monthPlanOf({ expected: 0, actual: 0 }, { expected: 300, actual: 0 }).remaining).toBe(-300)
  })
})
