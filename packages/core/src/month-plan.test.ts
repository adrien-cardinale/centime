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
  it("separates incomes from fixed expenses and counts only matched amounts as actual", () => {
    const plan = monthPlanOf(
      [
        { expectedAmount: 6200, actualAmount: 6150 },
        { expectedAmount: -1600, actualAmount: -1600 },
        { expectedAmount: -420, actualAmount: null },
      ],
      { expected: 1900, actual: 1120 },
    )
    expect(plan.income).toEqual({ expected: 6200, actual: 6150 })
    expect(plan.fixedExpenses).toEqual({ expected: 2020, actual: 1600 })
    expect(plan.envelopes).toEqual({ expected: 1900, actual: 1120 })
    expect(plan.remaining).toBe(2280)
  })

  it("goes negative when the month is over-allocated", () => {
    const plan = monthPlanOf([{ expectedAmount: -1200, actualAmount: null }], { expected: 300, actual: 0 })
    expect(plan.income).toEqual({ expected: 0, actual: 0 })
    expect(plan.remaining).toBe(-1500)
  })
})
