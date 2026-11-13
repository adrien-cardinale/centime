import { describe, expect, it } from "bun:test"
import { matchPendingToBooked, type PendingCandidate } from "./pending-match"

const booked = { accountId: "acc-1", bookingDate: "2026-03-05", amount: -11.95, sourceRef: null }

function candidate(id: string, overrides: Partial<PendingCandidate> = {}): PendingCandidate {
  return { id, accountId: "acc-1", bookingDate: "2026-03-03", amount: -11.95, sourceRef: null, ...overrides }
}

function matchedIds(matches: Map<number, PendingCandidate>): Record<number, string> {
  return Object.fromEntries([...matches].map(([index, match]) => [index, match.id]))
}

describe("matchPendingToBooked", () => {
  it("matches a pending entry booked a few days later under another label", () => {
    expect(matchedIds(matchPendingToBooked([booked], [candidate("p1")]))).toEqual({ 0: "p1" })
  })

  it("accepts a booking on the same day and up to seven days later", () => {
    expect(matchPendingToBooked([booked], [candidate("p1", { bookingDate: "2026-03-05" })]).size).toBe(1)
    expect(matchPendingToBooked([booked], [candidate("p1", { bookingDate: "2026-02-26" })]).size).toBe(1)
  })

  it("rejects a booking before the pending date or too late", () => {
    expect(matchPendingToBooked([booked], [candidate("p1", { bookingDate: "2026-03-06" })]).size).toBe(0)
    expect(matchPendingToBooked([booked], [candidate("p1", { bookingDate: "2026-02-25" })]).size).toBe(0)
  })

  it("requires the same account and amount", () => {
    expect(matchPendingToBooked([booked], [candidate("p1", { accountId: "acc-2" })]).size).toBe(0)
    expect(matchPendingToBooked([booked], [candidate("p1", { amount: -11.9 })]).size).toBe(0)
  })

  it("requires the same source reference when both entries have one", () => {
    const withRef = { ...booked, sourceRef: "R1" }
    expect(matchPendingToBooked([withRef], [candidate("p1", { sourceRef: "R2" })]).size).toBe(0)
    expect(matchPendingToBooked([withRef], [candidate("p1", { sourceRef: "R1" })]).size).toBe(1)
    expect(matchPendingToBooked([withRef], [candidate("p1")]).size).toBe(1)
  })

  it("prefers the closest pending date", () => {
    const candidates = [
      candidate("far", { bookingDate: "2026-03-01" }),
      candidate("near", { bookingDate: "2026-03-04" }),
    ]
    expect(matchedIds(matchPendingToBooked([booked], candidates))).toEqual({ 0: "near" })
  })

  it("matches each pending entry at most once", () => {
    const later = { ...booked, bookingDate: "2026-03-06" }
    const candidates = [candidate("p1", { bookingDate: "2026-03-04" }), candidate("p2", { bookingDate: "2026-03-02" })]
    expect(matchedIds(matchPendingToBooked([booked, later], candidates))).toEqual({ 0: "p1", 1: "p2" })
    expect(matchedIds(matchPendingToBooked([booked, later], [candidate("p1")]))).toEqual({ 0: "p1" })
  })

  it("skips entries left out of the matching", () => {
    expect(matchedIds(matchPendingToBooked([null, booked], [candidate("p1")]))).toEqual({ 1: "p1" })
  })
})
