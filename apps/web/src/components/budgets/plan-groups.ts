import { roundCents } from "@centime/core"
import type { Budget, BudgetOverviewItem, Theme } from "@/lib/api"
import i18n from "@/i18n"
import { formatAmount, formatDate } from "@/lib/format"

export type ThemeTotals = { available: number; spent: number; remaining: number }

export type ThemeBudgets = { theme: Theme | null; budgets: BudgetOverviewItem[]; totals: ThemeTotals }

function signedAmount(amount: number, currency: string): string {
  const formatted = formatAmount(amount, currency)
  return amount > 0 ? `+${formatted}` : formatted
}

function sumTotals(budgets: BudgetOverviewItem[]): ThemeTotals {
  const sum = (pick: (budget: BudgetOverviewItem) => number) =>
    roundCents(budgets.reduce((total, budget) => total + pick(budget), 0))
  return {
    available: sum((budget) => budget.status.available),
    spent: sum((budget) => budget.status.spent),
    remaining: sum((budget) => budget.status.remaining),
  }
}

export function groupByTheme(budgets: BudgetOverviewItem[], themes: Theme[]): ThemeBudgets[] {
  const known = new Set(themes.map((theme) => theme.id))
  const groups = [
    ...themes.map((theme) => ({ theme, budgets: budgets.filter((budget) => budget.themeId === theme.id) })),
    { theme: null, budgets: budgets.filter((budget) => budget.themeId === null || !known.has(budget.themeId)) },
  ]
  return groups
    .filter((group) => group.budgets.length > 0)
    .map((group) => ({ ...group, totals: sumTotals(group.budgets) }))
}

export function budgetDetails(status: BudgetOverviewItem["status"], currency: string): string[] {
  return [
    status.carry !== 0 && i18n.t("budgets.table.carry", { amount: signedAmount(status.carry, currency) }),
    status.pending > 0 && i18n.t("budgets.table.pending", { amount: formatAmount(status.pending, currency) }),
    status.projected !== null &&
      status.projected !== 0 &&
      i18n.t("budgets.table.projected", { amount: formatAmount(status.projected, currency) }),
  ].filter((detail) => detail !== false)
}

export function endDateNote({ endDate }: Pick<Budget, "endDate">): string[] {
  return endDate === null ? [] : [i18n.t("budgets.table.until", { date: formatDate(endDate) })]
}

export function transactionsSearchOf(budget: Pick<BudgetOverviewItem, "categoryId" | "status">) {
  const { range } = budget.status
  return { categoryId: budget.categoryId, from: range.start, to: range.end }
}
