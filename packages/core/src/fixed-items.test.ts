import { describe, expect, it } from "bun:test"
import { fixedItemPayloadSchema } from "./fixed-item-payload"
import {
  defaultOverviewRange,
  type FixedItemInput,
  type MatchedTransaction,
  matchOccurrences,
  monthlyEquivalent,
  nextOccurrence,
  type Occurrence,
  occurrencesBetween,
  reportOccurrences,
  summarizeItem,
} from "./fixed-items"
import { PERIODICITIES } from "./types"

const rent: FixedItemInput = {
  id: "rent",
  name: "Loyer fictif",
  expectedAmount: -1500,
  periodicity: "monthly",
  dueDay: 25,
  dueMonth: null,
  startDate: "2026-01-01",
  endDate: null,
}

function item(overrides: Partial<FixedItemInput>): FixedItemInput {
  return { ...rent, ...overrides }
}

function transaction(id: string, bookingDate: string, amount = -1500): MatchedTransaction {
  return { id, bookingDate, amount, rawLabel: `Ordre permanent ${id}` }
}

function dueDates(occurrences: Occurrence[]): string[] {
  return occurrences.map((occurrence) => occurrence.dueDate)
}

describe("monthlyEquivalent", () => {
  it.each([
    ["monthly", -1500, -1500],
    ["quarterly", -300, -100],
    ["yearly", 1200, 100],
  ] as const)("spreads a %s amount over one month", (periodicity, expectedAmount, expected) => {
    expect(monthlyEquivalent(item({ periodicity, expectedAmount }))).toBe(expected)
  })

  it("rounds to cents", () => {
    expect(monthlyEquivalent(item({ periodicity: "yearly", expectedAmount: -100 }))).toBe(-8.33)
  })
})

describe("occurrencesBetween", () => {
  it("clamps day 31 to the last day of short months", () => {
    const occurrences = occurrencesBetween(item({ dueDay: 31 }), "2026-01-01", "2026-04-30")
    expect(dueDates(occurrences)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"])
  })

  it("handles leap years", () => {
    const occurrences = occurrencesBetween(item({ dueDay: 30, startDate: "2028-01-01" }), "2028-02-01", "2028-02-29")
    expect(dueDates(occurrences)).toEqual(["2028-02-29"])
  })

  it("defaults to the first of the month without due day", () => {
    expect(dueDates(occurrencesBetween(item({ dueDay: null }), "2026-02-01", "2026-03-31"))).toEqual([
      "2026-02-01",
      "2026-03-01",
    ])
  })

  it("places quarterly occurrences on the chosen month of each quarter", () => {
    const quarterly = item({ periodicity: "quarterly", dueDay: 15, dueMonth: 2 })
    expect(dueDates(occurrencesBetween(quarterly, "2026-01-01", "2026-12-31"))).toEqual([
      "2026-02-15",
      "2026-05-15",
      "2026-08-15",
      "2026-11-15",
    ])
  })

  it("places yearly occurrences on the chosen month", () => {
    const yearly = item({ periodicity: "yearly", dueDay: 10, dueMonth: 11 })
    expect(dueDates(occurrencesBetween(yearly, "2026-01-01", "2028-06-30"))).toEqual(["2026-11-10", "2027-11-10"])
  })

  it("respects start and end dates inclusively", () => {
    const bounded = item({ dueDay: 25, startDate: "2026-02-25", endDate: "2026-05-25" })
    expect(dueDates(occurrencesBetween(bounded, "2026-01-01", "2026-12-31"))).toEqual([
      "2026-02-25",
      "2026-03-25",
      "2026-04-25",
      "2026-05-25",
    ])
  })

  it("excludes occurrences just outside the bounds", () => {
    const bounded = item({ dueDay: 25, startDate: "2026-02-26", endDate: "2026-05-24" })
    expect(dueDates(occurrencesBetween(bounded, "2026-01-01", "2026-12-31"))).toEqual(["2026-03-25", "2026-04-25"])
  })

  it("computes the matching window from the tolerance", () => {
    const [monthly] = occurrencesBetween(rent, "2026-03-01", "2026-03-31")
    expect(monthly).toMatchObject({ dueDate: "2026-03-25", windowStart: "2026-03-15", windowEnd: "2026-04-04" })
    const [yearly] = occurrencesBetween(item({ periodicity: "yearly", dueMonth: 1, dueDay: 15 }), "2026-01-01", "2026-12-31")
    expect(yearly).toMatchObject({ windowStart: "2025-12-16", windowEnd: "2026-02-14" })
  })

  it.each([...PERIODICITIES])("never overlaps the windows of consecutive %s occurrences", (periodicity) => {
    for (const dueDay of [1, 15, 28, 29, 30, 31]) {
      for (const dueMonth of periodicity === "monthly" ? [null] : [1, 2, 3]) {
        const occurrences = occurrencesBetween(
          item({ periodicity, dueDay, dueMonth, startDate: "2024-01-01" }),
          "2024-01-01",
          "2030-12-31",
        )
        for (const [index, occurrence] of occurrences.slice(1).entries()) {
          expect(occurrences[index]?.windowEnd.localeCompare(occurrence.windowStart)).toBe(-1)
        }
      }
    }
  })
})

describe("nextOccurrence", () => {
  it("returns the first occurrence due today or later", () => {
    expect(nextOccurrence(rent, "2026-03-25")?.dueDate).toBe("2026-03-25")
    expect(nextOccurrence(rent, "2026-03-26")?.dueDate).toBe("2026-04-25")
  })

  it("waits for the start date", () => {
    expect(nextOccurrence(item({ startDate: "2027-06-01" }), "2026-03-01")?.dueDate).toBe("2027-06-25")
  })

  it("returns null once the item has ended", () => {
    expect(nextOccurrence(item({ endDate: "2026-02-28" }), "2026-03-01")).toBeNull()
  })

  it("finds a yearly occurrence almost a year ahead", () => {
    const yearly = item({ periodicity: "yearly", dueMonth: 1, dueDay: 5 })
    expect(nextOccurrence(yearly, "2026-01-06")?.dueDate).toBe("2027-01-05")
  })
})

describe("matchOccurrences", () => {
  const occurrences = occurrencesBetween(rent, "2026-01-01", "2026-04-30")

  it("assigns transactions to the occurrence whose window contains them", () => {
    const reports = matchOccurrences(
      occurrences,
      [transaction("feb", "2026-02-20", -1500), transaction("mar", "2026-04-02", -1520)],
      "2026-05-10",
    )
    expect(reports.map((report) => report.status)).toEqual(["overdue", "paid", "paid", "overdue"])
    expect(reports[2]).toMatchObject({ actualAmount: -1520, deviation: -20 })
    expect(reports[0]).toMatchObject({ actualAmount: null, deviation: null, transactions: [] })
  })

  it("falls back to the closest occurrence outside every window", () => {
    const reports = matchOccurrences(occurrences, [transaction("late", "2026-05-20")], "2026-05-21")
    expect(reports[3]?.transactions.map((matched) => matched.id)).toEqual(["late"])
  })

  it("assigns each transaction once even when listed twice", () => {
    const duplicated = transaction("jan", "2026-01-24")
    const reports = matchOccurrences(occurrences, [duplicated, duplicated], "2026-02-01")
    expect(reports.flatMap((report) => report.transactions)).toHaveLength(1)
    expect(reports[0]?.actualAmount).toBe(-1500)
  })

  it("sums several transactions for one occurrence", () => {
    const reports = matchOccurrences(
      occurrences,
      [transaction("a", "2026-01-24", -1000), transaction("b", "2026-01-26", -500.1)],
      "2026-02-01",
    )
    expect(reports[0]).toMatchObject({ actualAmount: -1500.1, deviation: -0.1 })
  })

  it("derives the status of unpaid occurrences from today", () => {
    const [march] = occurrencesBetween(rent, "2026-03-01", "2026-03-31")
    if (!march) throw new Error("Échéance attendue")
    const statusOn = (today: string) => matchOccurrences([march], [], today)[0]?.status
    expect(statusOn("2026-03-14")).toBe("upcoming")
    expect(statusOn("2026-03-15")).toBe("due")
    expect(statusOn("2026-04-04")).toBe("due")
    expect(statusOn("2026-04-05")).toBe("overdue")
  })

  it("ignores transactions when there is no occurrence", () => {
    expect(matchOccurrences([], [transaction("x", "2026-01-01")], "2026-01-01")).toEqual([])
  })
})

describe("reportOccurrences", () => {
  it("keeps transactions of occurrences before the range away from the first one", () => {
    const reports = reportOccurrences(
      rent,
      [transaction("previous", "2026-01-24"), transaction("current", "2026-02-25")],
      { from: "2026-02-01", to: "2026-03-31" },
      "2026-04-10",
    )
    expect(reports.map((report) => [report.dueDate, report.status])).toEqual([
      ["2026-02-25", "paid"],
      ["2026-03-25", "overdue"],
    ])
    expect(reports[0]?.transactions.map((matched) => matched.id)).toEqual(["current"])
  })
})

describe("summarizeItem", () => {
  it("totals settled occurrences only", () => {
    const occurrences = occurrencesBetween(rent, "2026-01-01", "2026-04-30")
    const reports = matchOccurrences(occurrences, [transaction("jan", "2026-01-25", -1490)], "2026-03-20")
    expect(summarizeItem(reports)).toEqual({ expectedTotal: -3000, actualTotal: -1490, paidCount: 1, missedCount: 1 })
  })
})

describe("defaultOverviewRange", () => {
  it("spans two months back and three months ahead", () => {
    expect(defaultOverviewRange("2026-01-15")).toEqual({ from: "2025-11-01", to: "2026-04-30" })
  })
})

describe("fixedItemPayloadSchema", () => {
  const valid = {
    name: "Assurance fictive",
    expectedAmount: -120,
    periodicity: "quarterly",
    dueDay: 1,
    dueMonth: 3,
    categoryId: null,
    startDate: "2026-01-01",
    endDate: null,
  }

  it("accepts a valid payload with a matching rule", () => {
    const parsed = fixedItemPayloadSchema.safeParse({
      ...valid,
      rule: { pattern: "assurance", matchKind: "contains", field: "raw_label" },
    })
    expect(parsed.success).toBe(true)
  })

  it.each([
    ["a zero amount", { expectedAmount: 0 }, "expectedAmount"],
    ["a quarterly month above 3", { dueMonth: 4 }, "dueMonth"],
    ["a yearly item without month", { periodicity: "yearly", dueMonth: null }, "dueMonth"],
    ["a monthly item with a month", { periodicity: "monthly", dueMonth: 2 }, "dueMonth"],
    ["a day above 31", { dueDay: 32 }, "dueDay"],
    ["an end before the start", { endDate: "2025-12-31" }, "endDate"],
    ["an invalid date", { startDate: "2026-02-30" }, "startDate"],
    ["an empty name", { name: "  " }, "name"],
  ])("rejects %s", (_case, override, path) => {
    const parsed = fixedItemPayloadSchema.safeParse({ ...valid, ...override })
    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues.map((issue) => issue.path.join("."))).toContain(path)
  })

  it("rejects an invalid rule regex", () => {
    const parsed = fixedItemPayloadSchema.safeParse({ ...valid, rule: { pattern: "(", matchKind: "regex", field: "raw_label" } })
    expect(parsed.success).toBe(false)
  })
})
