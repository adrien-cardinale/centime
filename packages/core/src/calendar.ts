import { addDays, addMonths, format, parseISO } from "date-fns"
import type { IsoDate, Periodicity } from "./types"

export const PERIOD_MONTHS: Record<Periodicity, number> = { monthly: 1, quarterly: 3, yearly: 12 }

const ISO_FORMAT = "yyyy-MM-dd"

export function isoDateOf(date: Date): IsoDate {
  return format(date, ISO_FORMAT)
}

export function shiftDays(date: IsoDate, days: number): IsoDate {
  return isoDateOf(addDays(parseISO(date), days))
}

export function shiftMonths(date: IsoDate, months: number): IsoDate {
  return isoDateOf(addMonths(parseISO(date), months))
}

export function roundCents(amount: number): number {
  return Math.round(amount * 100) / 100
}
