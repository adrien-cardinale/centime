import { Link } from "@tanstack/react-router"
import { List, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { BudgetOverviewItem } from "@/lib/api"
import { transactionsSearchOf } from "./budget-groups"
import { DeleteBudgetDialog } from "./delete-budget-dialog"

type BudgetActionsMenuProps = {
  budget: BudgetOverviewItem
  onEdit: (budget: BudgetOverviewItem) => void
}

export function BudgetActionsMenu({ budget, onEdit }: BudgetActionsMenuProps) {
  const { t } = useTranslation()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const opensOverlay = useRef(false)
  const openOverlay = (open: () => void) => {
    opensOverlay.current = true
    open()
  }

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={t("budgets.actions.menu", { name: budget.categoryName })}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          onCloseAutoFocus={(event) => {
            // Le dialogue ouvert depuis le menu reprend lui-même le focus.
            if (opensOverlay.current) event.preventDefault()
            opensOverlay.current = false
          }}
        >
          <DropdownMenuItem asChild>
            <Link to="/transactions" search={transactionsSearchOf(budget)}>
              <List />
              {t("budgets.actions.viewTransactions")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openOverlay(() => onEdit(budget))}>
            <Pencil />
            {t("budgets.actions.edit")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => openOverlay(() => setConfirmOpen(true))}>
            <Trash2 />
            {t("budgets.actions.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DeleteBudgetDialog budget={budget} open={confirmOpen} onOpenChange={setConfirmOpen} />
    </>
  )
}
