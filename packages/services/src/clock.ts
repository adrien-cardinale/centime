import { isoDateOf } from "@centime/core"

export type Clock = () => Date

export const systemClock: Clock = () => new Date()

export function nowIso(clock: Clock): string {
  return clock().toISOString()
}

export function todayOf(clock: Clock): string {
  return isoDateOf(clock())
}
