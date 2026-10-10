import { type CategoryBreakdownEntry, UNCATEGORIZED_FILTER } from "@/lib/api"

export type MonthRange = { start: string; end: string; label: string }

type TransactionsSearch = { categoryId?: string; themeId?: string; from: string; to: string }

export function transactionsSearchOf(entry: CategoryBreakdownEntry, month: MonthRange): TransactionsSearch | null {
  if (entry.kind === "uncategorized") return { categoryId: UNCATEGORIZED_FILTER, from: month.start, to: month.end }
  if (entry.kind === "theme" && entry.themeId !== null) return { themeId: entry.themeId, from: month.start, to: month.end }
  if (entry.kind === "category" && entry.categoryId !== null) {
    return { categoryId: entry.categoryId, from: month.start, to: month.end }
  }
  return null
}

export function isNamedEntry(entry: CategoryBreakdownEntry): boolean {
  return entry.kind === "category" || entry.kind === "theme"
}

export function entryKey(entry: CategoryBreakdownEntry): string {
  return `${entry.kind}-${entry.themeId ?? entry.categoryId ?? entry.name}`
}
