import { Pencil, Trash2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { CategoryBadge } from "@/components/categories/category-badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useIsMobile } from "@/hooks/use-mobile"
import type { IncomeOverviewItem } from "@/lib/api"
import { progressPercent } from "@/lib/budgets"
import { DeleteBudgetDialog } from "./delete-budget-dialog"
import { money } from "./plan-groups"

type IncomeTableProps = {
  incomes: IncomeOverviewItem[]
  onEdit: (income: IncomeOverviewItem) => void
}

export function IncomeTable(props: IncomeTableProps) {
  const isMobile = useIsMobile()
  return isMobile ? <IncomeCardList {...props} /> : <DesktopIncomeTable {...props} />
}

function DesktopIncomeTable({ incomes, onEdit }: IncomeTableProps) {
  const { t } = useTranslation()
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-6">{t("budgetsPage.table.item")}</TableHead>
          <TableHead>{t("budgetsPage.table.period")}</TableHead>
          <TableHead className="text-right">{t("budgetsPage.table.planned")}</TableHead>
          <TableHead className="text-right">{t("budgetsPage.table.received")}</TableHead>
          <TableHead>{t("budgetsPage.table.tracking")}</TableHead>
          <TableHead className="text-right">{t("budgetsPage.table.remaining")}</TableHead>
          <TableHead className="pr-6 text-right">{t("budgetsPage.table.actions")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {incomes.map((income) => (
          <TableRow key={income.id} className="cursor-pointer" onClick={() => onEdit(income)}>
            <TableCell className="max-w-56 pl-6">
              <CategoryBadge name={income.categoryName} color={income.categoryColor} />
            </TableCell>
            <TableCell className="text-muted-foreground">{income.status.range.label}</TableCell>
            <TableCell className="text-right tabular-nums">{money(income.status.expected)}</TableCell>
            <TableCell className="text-right tabular-nums">{money(income.status.received)}</TableCell>
            <TableCell className="min-w-36">
              <Progress value={progressPercent(income.status.ratio)} className="bg-muted" />
            </TableCell>
            <TableCell className="text-right tabular-nums">{money(Math.max(0, income.status.remaining))}</TableCell>
            <TableCell className="pr-6" onClick={(event) => event.stopPropagation()}>
              <IncomeActions income={income} onEdit={onEdit} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function IncomeCardList({ incomes, onEdit }: IncomeTableProps) {
  const { t } = useTranslation()
  return (
    <ul className="divide-y">
      {incomes.map((income) => (
        <li key={income.id} className="flex items-start gap-2 px-4 py-3">
          <button
            type="button"
            onClick={() => onEdit(income)}
            className="flex min-w-0 flex-1 flex-col gap-2 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <CategoryBadge name={income.categoryName} color={income.categoryColor} className="max-w-full" />
            <span className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm tabular-nums">
              <span>
                {money(income.status.received)} / {money(income.status.expected)}
              </span>
              <span className="text-xs text-muted-foreground">{income.status.range.label}</span>
            </span>
            <Progress value={progressPercent(income.status.ratio)} className="bg-muted" />
            <span className="text-sm text-muted-foreground tabular-nums">
              {t("budgets.card.remaining", { amount: money(Math.max(0, income.status.remaining)) })}
            </span>
          </button>
          <IncomeActions income={income} onEdit={onEdit} />
        </li>
      ))}
    </ul>
  )
}

function IncomeActions({
  income,
  onEdit,
}: {
  income: IncomeOverviewItem
  onEdit: (income: IncomeOverviewItem) => void
}) {
  const { t } = useTranslation()
  const [confirmOpen, setConfirmOpen] = useState(false)
  return (
    <div className="flex justify-end gap-1">
      <Button
        variant="ghost"
        size="icon"
        aria-label={t("budgets.table.edit", { name: income.categoryName })}
        onClick={() => onEdit(income)}
      >
        <Pencil />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t("budgets.table.delete", { name: income.categoryName })}
        onClick={() => setConfirmOpen(true)}
      >
        <Trash2 />
      </Button>
      <DeleteBudgetDialog budget={income} open={confirmOpen} onOpenChange={setConfirmOpen} />
    </div>
  )
}
