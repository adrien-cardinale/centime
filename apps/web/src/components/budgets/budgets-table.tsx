import { roundCents } from "@centime/core"
import { Link } from "@tanstack/react-router"
import { List, Pencil, Trash2 } from "lucide-react"
import { Fragment, useState } from "react"
import { Amount } from "@/components/amount"
import { CategoryBadge } from "@/components/categories/category-badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { BudgetOverviewItem, BudgetTotals, Theme } from "@/lib/api"
import { BUDGET_CURRENCY, budgetStateIndicatorClasses, budgetStateTextClasses, progressPercent } from "@/lib/budgets"
import { formatAmount } from "@/lib/format"
import { budgetStateLabels } from "@/lib/labels"
import { cn } from "@/lib/utils"
import { DeleteBudgetDialog } from "./delete-budget-dialog"

type BudgetsTableProps = {
  budgets: BudgetOverviewItem[]
  themes: Theme[]
  onEdit: (budget: BudgetOverviewItem) => void
}

type ThemeBudgets = { theme: Theme | null; budgets: BudgetOverviewItem[]; totals: BudgetTotals }

function money(amount: number): string {
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

function groupByTheme(budgets: BudgetOverviewItem[], themes: Theme[]): ThemeBudgets[] {
  const known = new Set(themes.map((theme) => theme.id))
  const groups = [
    ...themes.map((theme) => ({ theme, budgets: budgets.filter((budget) => budget.themeId === theme.id) })),
    { theme: null, budgets: budgets.filter((budget) => budget.themeId === null || !known.has(budget.themeId)) },
  ]
  return groups.filter((group) => group.budgets.length > 0).map((group) => ({ ...group, totals: sumTotals(group.budgets) }))
}

export function BudgetsTable({ budgets, themes, onEdit }: BudgetsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-6">Catégorie</TableHead>
          <TableHead>Période</TableHead>
          <TableHead className="text-right">Budget</TableHead>
          <TableHead className="text-right">Dépensé</TableHead>
          <TableHead>Avancement</TableHead>
          <TableHead className="text-right">Reste</TableHead>
          <TableHead className="pr-6 text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {groupByTheme(budgets, themes).map((group) => (
          <Fragment key={group.theme?.id ?? "none"}>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableCell colSpan={2} className="pl-6 font-semibold">
                {group.theme?.name ?? "Sans thème"}
              </TableCell>
              <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                {money(group.totals.available)}
              </TableCell>
              <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                {money(group.totals.spent)}
              </TableCell>
              <TableCell />
              <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                {money(group.totals.remaining)}
              </TableCell>
              <TableCell className="pr-6" />
            </TableRow>
            {group.budgets.map((budget) => (
              <BudgetRow key={budget.id} budget={budget} onEdit={onEdit} />
            ))}
          </Fragment>
        ))}
      </TableBody>
    </Table>
  )
}

function budgetDetails(status: BudgetOverviewItem["status"]): string[] {
  return [
    status.carry !== 0 && `Report : ${signedMoney(status.carry)}`,
    status.pending > 0 && `En suspens : ${money(status.pending)}`,
    status.projected !== null && status.projected !== 0 && `Au rythme actuel : ${money(status.projected)}`,
  ].filter((detail) => detail !== false)
}

function BudgetRow({ budget, onEdit }: { budget: BudgetOverviewItem; onEdit: (budget: BudgetOverviewItem) => void }) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const { status } = budget
  const { range } = status
  const details = budgetDetails(status)
  return (
    <TableRow className="cursor-pointer" onClick={() => onEdit(budget)}>
      <TableCell className="max-w-56 pl-6">
        <CategoryBadge name={budget.categoryName} color={budget.categoryColor} />
        {details.length > 0 && <p className="mt-1 truncate text-xs text-muted-foreground">{details.join(" · ")}</p>}
      </TableCell>
      <TableCell className="text-muted-foreground">{range.label}</TableCell>
      <TableCell className="text-right">
        <Amount amount={status.available} currency={BUDGET_CURRENCY} />
      </TableCell>
      <TableCell className="text-right">
        <Amount amount={status.spent} currency={BUDGET_CURRENCY} />
      </TableCell>
      <TableCell className="min-w-36">
        <div className="space-y-1">
          <Progress
            value={progressPercent(status.ratio)}
            className="bg-muted"
            indicatorClassName={budgetStateIndicatorClasses[status.state]}
          />
          <span className={cn("text-xs font-medium", budgetStateTextClasses[status.state])}>
            {budgetStateLabels[status.state]}
          </span>
        </div>
      </TableCell>
      <TableCell className="text-right">
        <span className={cn("tabular-nums whitespace-nowrap", status.remaining < 0 && budgetStateTextClasses.exceeded)}>
          {money(status.remaining)}
        </span>
      </TableCell>
      <TableCell className="pr-6" onClick={(event) => event.stopPropagation()}>
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" aria-label={`Voir les transactions de ${budget.categoryName}`} asChild>
            <Link to="/transactions" search={{ categoryId: budget.categoryId, from: range.start, to: range.end }}>
              <List />
            </Link>
          </Button>
          <Button variant="ghost" size="icon" aria-label={`Modifier ${budget.categoryName}`} onClick={() => onEdit(budget)}>
            <Pencil />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Supprimer ${budget.categoryName}`}
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 />
          </Button>
          <DeleteBudgetDialog budget={budget} open={confirmOpen} onOpenChange={setConfirmOpen} />
        </div>
      </TableCell>
    </TableRow>
  )
}
