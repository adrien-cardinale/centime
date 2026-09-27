import { Link } from "@tanstack/react-router"
import { List, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { useState } from "react"
import { CategoryBadge } from "@/components/categories/category-badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Progress } from "@/components/ui/progress"
import type { BudgetOverviewItem } from "@/lib/api"
import { BUDGET_CURRENCY, budgetStateIndicatorClasses, budgetStateTextClasses, progressPercent } from "@/lib/budgets"
import { formatAmount } from "@/lib/format"
import { budgetStateLabels } from "@/lib/labels"
import { cn } from "@/lib/utils"
import { BudgetHistory } from "./budget-history"
import { DeleteBudgetDialog } from "./delete-budget-dialog"

type BudgetCardProps = {
  budget: BudgetOverviewItem
  onEdit: (budget: BudgetOverviewItem) => void
}

function money(amount: number): string {
  return formatAmount(amount, BUDGET_CURRENCY)
}

function signedMoney(amount: number): string {
  return amount > 0 ? `+${money(amount)}` : money(amount)
}

export function BudgetCard({ budget, onEdit }: BudgetCardProps) {
  const { status } = budget
  return (
    <Card className="gap-4">
      <CardHeader>
        <CategoryBadge name={budget.categoryName} color={budget.categoryColor} className="w-fit" />
        <CardDescription>{status.range.label}</CardDescription>
        <CardAction>
          <BudgetActions budget={budget} onEdit={onEdit} />
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <p className="tabular-nums">
              <span className="text-lg font-semibold">{money(status.spent)}</span>
              <span className="text-sm text-muted-foreground"> / {money(status.available)}</span>
            </p>
            <span className={cn("text-xs font-medium", budgetStateTextClasses[status.state])}>
              {budgetStateLabels[status.state]}
            </span>
          </div>
          <Progress
            value={progressPercent(status.ratio)}
            className="bg-muted"
            indicatorClassName={budgetStateIndicatorClasses[status.state]}
          />
          <p className="text-sm">
            {status.remaining >= 0 ? (
              <>
                Reste <span className="font-medium tabular-nums">{money(status.remaining)}</span>
              </>
            ) : (
              <span className={budgetStateTextClasses.exceeded}>
                Dépassé de <span className="font-medium tabular-nums">{money(-status.remaining)}</span>
              </span>
            )}
          </p>
        </div>
        <BudgetDetails status={status} />
        <BudgetHistory history={budget.history} amount={budget.amount} />
      </CardContent>
    </Card>
  )
}

function BudgetDetails({ status }: { status: BudgetOverviewItem["status"] }) {
  const details = [
    status.carry !== 0 && `Report : ${signedMoney(status.carry)}`,
    status.pending > 0 && `En suspens : ${money(status.pending)}`,
    status.projected !== null && status.projected !== 0 && `Au rythme actuel : ${money(status.projected)}`,
  ].filter((detail) => detail !== false)
  if (details.length === 0) return null
  return (
    <ul className="space-y-0.5 text-xs text-muted-foreground">
      {details.map((detail) => (
        <li key={detail}>{detail}</li>
      ))}
    </ul>
  )
}

function BudgetActions({ budget, onEdit }: BudgetCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const { range } = budget.status
  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Actions pour ${budget.categoryName}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onCloseAutoFocus={(event) => event.preventDefault()}>
          <DropdownMenuItem onSelect={() => onEdit(budget)}>
            <Pencil />
            Modifier
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/transactions" search={{ categoryId: budget.categoryId, from: range.start, to: range.end, includeChildren: true }}>
              <List />
              Voir les transactions
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
            <Trash2 />
            Supprimer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DeleteBudgetDialog budget={budget} open={confirmOpen} onOpenChange={setConfirmOpen} />
    </>
  )
}
