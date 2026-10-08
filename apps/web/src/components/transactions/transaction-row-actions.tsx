import { useRef } from "react"
import { ArrowLeftRight, MoreHorizontal, Repeat, Wand2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useUpdateTransaction } from "@/hooks/use-transaction-updates"
import type { TransactionItem } from "@/lib/api"

type TransactionRowActionsProps = {
  transaction: TransactionItem
  onCreateRule: (transaction: TransactionItem) => void
  onLinkFixedItem: (transaction: TransactionItem) => void
}

export function TransactionRowActions({ transaction, onCreateRule, onLinkFixedItem }: TransactionRowActionsProps) {
  const { t } = useTranslation()
  const update = useUpdateTransaction()
  const opensOverlay = useRef(false)
  const toggleTransfer = () =>
    update.mutate({ id: transaction.id, changes: { isTransfer: !transaction.isTransfer } })

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-10 md:size-9" aria-label={t("transactionsPage.actions")}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onCloseAutoFocus={(event) => {
          // Quand l'action ouvre un dialogue ou une liste, c'est eux qui reprennent le focus.
          if (opensOverlay.current) event.preventDefault()
          opensOverlay.current = false
        }}>
        <DropdownMenuItem onSelect={toggleTransfer} disabled={update.isPending}>
          <ArrowLeftRight />
          {transaction.isTransfer ? t("transactionsPage.removeTransfer") : t("transactionsPage.markTransfer")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => {
            opensOverlay.current = true
            onLinkFixedItem(transaction)
          }}>
          <Repeat />
          {t("transactionsPage.linkFixedItem")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => {
            opensOverlay.current = true
            onCreateRule(transaction)
          }}>
          <Wand2 />
          {t("transactionsPage.createRule")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
