import { type fixedItemPayloadSchema, isoDateOf, type Periodicity, type RuleMatcherInput } from "@centime/core"
import { startOfMonth } from "date-fns"
import type { z } from "zod"
import type { FixedItem } from "@/lib/api"
import { parseAmountInput } from "@/lib/format"

export type FixedItemFormValues = z.input<typeof fixedItemPayloadSchema>

export const NO_CATEGORY = "none"

export function amountFromText(text: string): number {
  if (text.trim() === "") return 0
  const amount = parseAmountInput(text)
  return amount === null ? Number.NaN : Math.abs(amount)
}

export function emptyRule(pattern: string): RuleMatcherInput {
  return { pattern, matchKind: "contains", field: "raw_label" }
}

export function defaultDueMonth(periodicity: Periodicity, current: number | null): number | null {
  if (periodicity === "monthly") return null
  const maximum = periodicity === "quarterly" ? 3 : 12
  return current !== null && current <= maximum ? current : 1
}

function firstOfCurrentMonth(): string {
  return isoDateOf(startOfMonth(new Date()))
}

export function formValuesFor(item: FixedItem | undefined): FixedItemFormValues {
  if (!item) {
    return {
      name: "",
      expectedAmount: 0,
      periodicity: "monthly",
      dueDay: 1,
      dueMonth: null,
      categoryId: null,
      startDate: firstOfCurrentMonth(),
      endDate: null,
      rule: null,
    }
  }
  return {
    name: item.name,
    expectedAmount: item.expectedAmount,
    periodicity: item.periodicity,
    dueDay: item.dueDay,
    dueMonth: item.dueMonth,
    categoryId: item.categoryId,
    startDate: item.startDate,
    endDate: item.endDate,
    rule: item.rule ? { pattern: item.rule.pattern, matchKind: item.rule.matchKind, field: item.rule.field } : null,
  }
}
