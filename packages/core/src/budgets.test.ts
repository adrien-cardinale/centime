import { describe, expect, it } from "bun:test"
import { budgetPayloadSchema } from "./budget-payload"
import {
  type BudgetInput,
  budgetStateOf,
  computeBudgetStatus,
  type PeriodRange,
  type PeriodSpending,
  periodContaining,
  previousPeriods,
  shiftPeriod,
} from "./budgets"

const groceries: BudgetInput = { id: "groceries", amount: 500, period: "monthly", rollover: false, startDate: "2026-01-01" }

function budget(overrides: Partial<BudgetInput>): BudgetInput {
  return { ...groceries, ...overrides }
}

function spending(range: PeriodRange, spent: number, pending = 0): PeriodSpending {
  return { range, spent, pending }
}

function monthsBefore(date: string, count: number, spent: number): PeriodSpending[] {
  return previousPeriods("monthly", periodContaining("monthly", date), count).map((range) => spending(range, spent))
}

const september = periodContaining("monthly", "2026-09-15")
const AFTER_SEPTEMBER = "2026-10-05"

describe("periodContaining", () => {
  it("bounds a month and labels it in French", () => {
    expect(periodContaining("monthly", "2026-09-15")).toEqual({
      start: "2026-09-01",
      end: "2026-09-30",
      label: "Septembre 2026",
    })
    expect(periodContaining("monthly", "2028-02-29")).toMatchObject({ start: "2028-02-01", end: "2028-02-29" })
    expect(periodContaining("monthly", "2026-08-31").label).toBe("Août 2026")
  })

  it("bounds a quarter", () => {
    expect(periodContaining("quarterly", "2026-08-10")).toEqual({ start: "2026-07-01", end: "2026-09-30", label: "T3 2026" })
    expect(periodContaining("quarterly", "2026-12-31")).toMatchObject({ start: "2026-10-01", end: "2026-12-31", label: "T4 2026" })
    expect(periodContaining("quarterly", "2026-01-01").label).toBe("T1 2026")
  })

  it("bounds a year", () => {
    expect(periodContaining("yearly", "2026-06-30")).toEqual({ start: "2026-01-01", end: "2026-12-31", label: "2026" })
  })
})

describe("shiftPeriod and previousPeriods", () => {
  it("shifts across year boundaries", () => {
    expect(shiftPeriod("monthly", periodContaining("monthly", "2026-01-31"), -1)).toMatchObject({
      start: "2025-12-01",
      end: "2025-12-31",
    })
    expect(shiftPeriod("quarterly", periodContaining("quarterly", "2026-11-02"), 1).label).toBe("T1 2027")
    expect(shiftPeriod("yearly", periodContaining("yearly", "2026-03-01"), -2).label).toBe("2024")
  })

  it("lists previous periods from oldest to newest", () => {
    const labels = previousPeriods("monthly", september, 3).map((range) => range.label)
    expect(labels).toEqual(["Juin 2026", "Juillet 2026", "Août 2026"])
    expect(previousPeriods("quarterly", periodContaining("quarterly", "2026-02-01"), 2).map((range) => range.label)).toEqual([
      "T3 2025",
      "T4 2025",
    ])
  })
})

describe("budgetStateOf", () => {
  it("returns ok, warning or exceeded", () => {
    expect(budgetStateOf(100, 500)).toBe("ok")
    expect(budgetStateOf(400, 500)).toBe("warning")
    expect(budgetStateOf(500, 500)).toBe("warning")
    expect(budgetStateOf(500.01, 500)).toBe("exceeded")
  })

  it("treats a non-positive availability as exhausted", () => {
    expect(budgetStateOf(0, 0)).toBe("ok")
    expect(budgetStateOf(10, 0)).toBe("exceeded")
    expect(budgetStateOf(0, -20)).toBe("exceeded")
  })
})

describe("computeBudgetStatus", () => {
  it("computes remaining and ratio without rollover", () => {
    const status = computeBudgetStatus(groceries, spending(september, 200, 30), monthsBefore("2026-09-15", 3, 100), AFTER_SEPTEMBER)
    expect(status).toMatchObject({
      carry: 0,
      available: 500,
      spent: 200,
      pending: 30,
      remaining: 300,
      ratio: 0.4,
      state: "ok",
      projected: null,
    })
  })

  it("adds a positive carry from underspent periods", () => {
    const status = computeBudgetStatus(
      budget({ rollover: true }),
      spending(september, 450),
      monthsBefore("2026-09-15", 2, 400),
      AFTER_SEPTEMBER,
    )
    expect(status).toMatchObject({ carry: 200, available: 700, remaining: 250, state: "ok" })
  })

  it("subtracts a negative carry from overspent periods", () => {
    const status = computeBudgetStatus(
      budget({ rollover: true }),
      spending(september, 250),
      monthsBefore("2026-09-15", 1, 800),
      AFTER_SEPTEMBER,
    )
    expect(status).toMatchObject({ carry: -300, available: 200, remaining: -50, state: "exceeded" })
  })

  it("limits the carry to the last 12 periods", () => {
    const status = computeBudgetStatus(
      budget({ rollover: true, startDate: "2020-01-01" }),
      spending(september, 0),
      monthsBefore("2026-09-15", 20, 490),
      AFTER_SEPTEMBER,
    )
    expect(status.carry).toBe(120)
  })

  it("ignores periods ending before the start date", () => {
    const status = computeBudgetStatus(
      budget({ rollover: true, startDate: "2026-07-20" }),
      spending(september, 0),
      monthsBefore("2026-09-15", 6, 300),
      AFTER_SEPTEMBER,
    )
    expect(status.carry).toBe(400)
  })

  it("reports full consumption when availability is not positive", () => {
    const status = computeBudgetStatus(
      budget({ rollover: true }),
      spending(september, 50),
      monthsBefore("2026-09-15", 1, 1000),
      AFTER_SEPTEMBER,
    )
    expect(status).toMatchObject({ available: 0, ratio: 1, state: "exceeded", remaining: -50 })
  })

  it("projects the spending over the current period", () => {
    const status = computeBudgetStatus(groceries, spending(september, 150), [], "2026-09-10")
    expect(status.projected).toBe(450)
  })

  it("counts at least one elapsed day on the first day", () => {
    expect(computeBudgetStatus(groceries, spending(september, 10), [], "2026-09-01").projected).toBe(300)
  })

  it("has no projection for past or future periods", () => {
    expect(computeBudgetStatus(groceries, spending(september, 10), [], "2026-08-31").projected).toBeNull()
    expect(computeBudgetStatus(groceries, spending(september, 10), [], AFTER_SEPTEMBER).projected).toBeNull()
  })

  it("flags a warning from 80 % of the availability", () => {
    expect(computeBudgetStatus(groceries, spending(september, 420), [], AFTER_SEPTEMBER).state).toBe("warning")
  })
})

describe("budgetPayloadSchema", () => {
  const payload = { categoryId: "c1", amount: 300, period: "monthly", rollover: true, startDate: "2026-09-01" }

  it("accepts a valid payload", () => {
    expect(budgetPayloadSchema.safeParse(payload).success).toBe(true)
  })

  it("rejects an empty category, a non-positive amount and an invalid date", () => {
    expect(budgetPayloadSchema.safeParse({ ...payload, categoryId: "" }).error?.issues[0]?.message).toBe(
      "Choisissez une catégorie",
    )
    expect(budgetPayloadSchema.safeParse({ ...payload, amount: 0 }).error?.issues[0]?.message).toBe(
      "Le montant doit être supérieur à zéro",
    )
    expect(budgetPayloadSchema.safeParse({ ...payload, startDate: "2026-02-30" }).success).toBe(false)
  })
})
