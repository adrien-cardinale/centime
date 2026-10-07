import { Repeat } from "lucide-react"
import { useTranslation } from "react-i18next"
import { FixedItemCommand } from "@/components/fixed-items/fixed-item-command"
import { Button } from "@/components/ui/button"
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
  const { t } = useTranslation()
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
            <DialogTitle>{t("transactionsPage.linkFixedItem")}</DialogTitle>
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
  const { t } = useTranslation()
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClick}
          aria-label={t("transactionsPage.fixedItemLabel", { name })}
          className="size-6 text-muted-foreground hover:text-foreground"
        >
          <Repeat className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{name}</TooltipContent>
    </Tooltip>
  )
}
