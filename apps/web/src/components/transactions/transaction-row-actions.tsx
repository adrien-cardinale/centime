import { ArrowLeftRight, MoreHorizontal, Repeat, Wand2 } from "lucide-react"
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
  const update = useUpdateTransaction()
  const toggleTransfer = () =>
    update.mutate({ id: transaction.id, changes: { isTransfer: !transaction.isTransfer } })

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Actions">
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onCloseAutoFocus={(event) => event.preventDefault()}>
        <DropdownMenuItem onSelect={toggleTransfer} disabled={update.isPending}>
          <ArrowLeftRight />
          {transaction.isTransfer ? "Retirer le transfert" : "Marquer comme transfert"}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onLinkFixedItem(transaction)}>
          <Repeat />
          Lier à un poste fixe
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onCreateRule(transaction)}>
          <Wand2 />
          Créer une règle depuis cette transaction
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
