import { Repeat } from "lucide-react"
import { FixedItemCommand } from "@/components/fixed-items/fixed-item-command"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useUpdateTransaction } from "@/hooks/use-transaction-updates"
import type { TransactionItem } from "@/lib/api"

type FixedItemCellProps = {
  transaction: TransactionItem
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FixedItemCell({ transaction, open, onOpenChange }: FixedItemCellProps) {
  const update = useUpdateTransaction()

  const choose = (fixedItemId: string | null) => {
    onOpenChange(false)
    if (fixedItemId === transaction.fixedItemId) return
    update.mutate({ id: transaction.id, changes: { fixedItemId } })
  }

  return (
    <>
      <span className="inline-flex size-6 items-center justify-center">
        {transaction.fixedItemName && <LinkedIndicator name={transaction.fixedItemName} onClick={() => onOpenChange(true)} />}
      </span>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="gap-3 p-4 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Lier à un poste fixe</DialogTitle>
            <DialogDescription className="truncate">{transaction.rawLabel}</DialogDescription>
          </DialogHeader>
          <div className="overflow-hidden rounded-md border">
            <FixedItemCommand selectedId={transaction.fixedItemId} onSelect={choose} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function LinkedIndicator({ name, onClick }: { name: string; onClick: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={`Poste fixe : ${name}`}
          className="rounded-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Repeat className="size-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent>{name}</TooltipContent>
    </Tooltip>
  )
}
