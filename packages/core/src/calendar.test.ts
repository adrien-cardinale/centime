import { describe, expect, it } from "bun:test"
import { roundCents, shiftDays, shiftMonths } from "./calendar"

describe("calendar helpers", () => {
  it("shifts dates by days and months", () => {
    expect(shiftDays("2026-02-27", 2)).toBe("2026-03-01")
    expect(shiftMonths("2026-01-31", 1)).toBe("2026-02-28")
  })

  it("rounds to cents", () => {
    expect(roundCents(10.005)).toBe(10.01)
    expect(roundCents(-3.333)).toBe(-3.33)
  })
})
