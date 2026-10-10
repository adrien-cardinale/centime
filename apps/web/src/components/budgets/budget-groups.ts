import { roundCents } from "@centime/core"
import type { BudgetOverviewItem, BudgetTotals, Theme } from "@/lib/api"
import { BUDGET_CURRENCY } from "@/lib/budgets"
import i18n from "@/i18n"
import { formatAmount } from "@/lib/format"

export type ThemeBudgets = { theme: Theme | null; budgets: BudgetOverviewItem[]; totals: BudgetTotals }

export function money(amount: number): string {
  return formatAmount(amount, BUDGET_CURRENCY)
}

function signedMoney(amount: number): string {
  return amount > 0 ? `+${money(amount)}` : money(amount)
}

function sumTotals(budgets: BudgetOverviewItem[]): BudgetTotals {
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
  return groups.filter((group) => group.budgets.length > 0).map((group) => ({ ...group, totals: sumTotals(group.budgets) }))
}

export function budgetDetails(status: BudgetOverviewItem["status"]): string[] {
  return [
    status.carry !== 0 && i18n.t("budgets.table.carry", { amount: signedMoney(status.carry) }),
    status.pending > 0 && i18n.t("budgets.table.pending", { amount: money(status.pending) }),
    status.projected !== null && status.projected !== 0 && i18n.t("budgets.table.projected", { amount: money(status.projected) }),
  ].filter((detail) => detail !== false)
}

export function transactionsSearchOf(budget: BudgetOverviewItem) {
  const { range } = budget.status
  return { categoryId: budget.categoryId, from: range.start, to: range.end }
}
