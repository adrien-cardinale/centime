import { Link } from "@tanstack/react-router"
import { List, Trash2 } from "lucide-react"
import { Fragment, type MouseEvent, useState } from "react"
import { useTranslation } from "react-i18next"
import { Amount } from "@/components/amount"
import { CategoryBadge } from "@/components/categories/category-badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useIsMobile } from "@/hooks/use-mobile"
import type { BudgetOverviewItem, Theme } from "@/lib/api"
import { BUDGET_CURRENCY, budgetStateIndicatorClasses, budgetStateTextClasses, progressPercent } from "@/lib/budgets"
import { budgetStateLabels } from "@/lib/labels"
import { cn } from "@/lib/utils"
import { BudgetCardList } from "./budget-card-list"
import { budgetDetails, groupByTheme, money, type ThemeBudgets, transactionsSearchOf } from "./budget-groups"
import { DeleteBudgetDialog } from "./delete-budget-dialog"

type BudgetsTableProps = {
  budgets: BudgetOverviewItem[]
  themes: Theme[]
  onEdit: (budget: BudgetOverviewItem) => void
}

export function BudgetsTable(props: BudgetsTableProps) {
  const isMobile = useIsMobile()
  return isMobile ? <BudgetCardList {...props} /> : <DesktopBudgetsTable {...props} />
}

function DesktopBudgetsTable({ budgets, themes, onEdit }: BudgetsTableProps) {
  const { t } = useTranslation()
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-6">{t("budgets.table.category")}</TableHead>
          <TableHead>{t("budgets.table.period")}</TableHead>
          <TableHead className="text-right">{t("budgets.table.budget")}</TableHead>
          <TableHead className="text-right">{t("budgets.table.spent")}</TableHead>
          <TableHead>{t("budgets.table.progress")}</TableHead>
          <TableHead className="text-right">{t("budgets.table.remaining")}</TableHead>
          <TableHead className="pr-6 text-right">{t("budgets.table.actions")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {groupByTheme(budgets, themes).map((group) => (
          <Fragment key={group.theme?.id ?? "none"}>
            <ThemeRow group={group} />
            {group.budgets.map((budget) => (
              <BudgetRow key={budget.id} budget={budget} onEdit={onEdit} />
            ))}
          </Fragment>
        ))}
      </TableBody>
    </Table>
  )
}

function ThemeRow({ group }: { group: ThemeBudgets }) {
  const { t } = useTranslation()
  return (
    <TableRow className="bg-muted/40 hover:bg-muted/40">
      <TableCell colSpan={2} className="pl-6 font-semibold">
        {group.theme?.name ?? t("budgets.table.noTheme")}
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
  )
}

function BudgetRow({ budget, onEdit }: { budget: BudgetOverviewItem; onEdit: (budget: BudgetOverviewItem) => void }) {
  const { t } = useTranslation()
  const { status } = budget
  const details = budgetDetails(status)
  const edit = (event: MouseEvent) => {
    event.stopPropagation()
    onEdit(budget)
  }
  return (
    <TableRow className="cursor-pointer" onClick={() => onEdit(budget)}>
      <TableCell className="max-w-56 pl-6">
        <button
          type="button"
          onClick={edit}
          aria-label={t("budgets.table.edit", { name: budget.categoryName })}
          className="max-w-full rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <CategoryBadge name={budget.categoryName} color={budget.categoryColor} />
        </button>
        {details.length > 0 && <p className="mt-1 text-xs whitespace-normal text-muted-foreground">{details.join(" · ")}</p>}
      </TableCell>
      <TableCell className="text-muted-foreground">{status.range.label}</TableCell>
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
        <BudgetRowActions budget={budget} />
      </TableCell>
    </TableRow>
  )
}

function BudgetRowActions({ budget }: { budget: BudgetOverviewItem }) {
  const { t } = useTranslation()
  const [confirmOpen, setConfirmOpen] = useState(false)
  return (
    <div className="flex justify-end gap-1">
      <Button variant="ghost" size="icon" aria-label={t("budgets.table.viewTransactions", { name: budget.categoryName })} asChild>
        <Link to="/transactions" search={transactionsSearchOf(budget)}>
          <List />
        </Link>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t("budgets.table.delete", { name: budget.categoryName })}
        onClick={() => setConfirmOpen(true)}
      >
        <Trash2 />
      </Button>
      <DeleteBudgetDialog budget={budget} open={confirmOpen} onOpenChange={setConfirmOpen} />
    </div>
  )
}
