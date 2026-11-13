import { differenceInCalendarDays, parseISO } from "date-fns"
import { formatAmountForFingerprint } from "./fingerprint"
import type { IsoDate } from "./types"

export type PendingMatchEntry = {
  accountId: string
  bookingDate: IsoDate
  amount: number
  sourceRef: string | null
}

export type PendingCandidate = PendingMatchEntry & { id: string }

type MatchPair = { bookedIndex: number; candidate: PendingCandidate; delay: number }

export const MAX_BOOKING_DELAY_DAYS = 7

function sameSourceRef(left: string | null, right: string | null): boolean {
  return left === null || right === null || left === right
}

function bookingDelay(booked: PendingMatchEntry, candidate: PendingCandidate): number | null {
  if (booked.accountId !== candidate.accountId) return null
  if (formatAmountForFingerprint(booked.amount) !== formatAmountForFingerprint(candidate.amount)) return null
  if (!sameSourceRef(booked.sourceRef, candidate.sourceRef)) return null
  const delay = differenceInCalendarDays(parseISO(booked.bookingDate), parseISO(candidate.bookingDate))
  return delay >= 0 && delay <= MAX_BOOKING_DELAY_DAYS ? delay : null
}

function comparePairs(left: MatchPair, right: MatchPair): number {
  return (
    left.delay - right.delay ||
    left.bookedIndex - right.bookedIndex ||
    left.candidate.bookingDate.localeCompare(right.candidate.bookingDate) ||
    left.candidate.id.localeCompare(right.candidate.id)
  )
}

export function matchPendingToBooked(
  booked: readonly (PendingMatchEntry | null)[],
  candidates: readonly PendingCandidate[],
): Map<number, PendingCandidate> {
  const pairs: MatchPair[] = []
  booked.forEach((entry, bookedIndex) => {
    if (entry === null) return
    for (const candidate of candidates) {
      const delay = bookingDelay(entry, candidate)
      if (delay !== null) pairs.push({ bookedIndex, candidate, delay })
    }
  })
  const matches = new Map<number, PendingCandidate>()
  const usedIds = new Set<string>()
  for (const pair of pairs.sort(comparePairs)) {
    if (matches.has(pair.bookedIndex) || usedIds.has(pair.candidate.id)) continue
    matches.set(pair.bookedIndex, pair.candidate)
    usedIds.add(pair.candidate.id)
  }
  return matches
}
