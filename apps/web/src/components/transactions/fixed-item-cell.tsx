import { Repeat } from "lucide-react"
import { useTranslation } from "react-i18next"
import { FixedItemCommand } from "@/components/fixed-items/fixed-item-command"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useIsMobile } from "@/hooks/use-mobile"
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
  const isMobile = useIsMobile()

  const choose = (fixedItemId: string | null) => {
    onOpenChange(false)
    if (fixedItemId === transaction.fixedItemId) return
    update.mutate({ id: transaction.id, changes: { fixedItemId } })
  }

  return (
    <>
      {transaction.fixedItemName &&
        (isMobile ? (
          <LinkedBadge name={transaction.fixedItemName} onClick={() => onOpenChange(true)} />
        ) : (
          <LinkedIndicator name={transaction.fixedItemName} onClick={() => onOpenChange(true)} />
        ))}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="gap-3 p-4 sm:max-w-sm"
          onOpenAutoFocus={isMobile ? (event) => event.preventDefault() : undefined}
        >
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

function LinkedBadge({ name, onClick }: { name: string; onClick: () => void }) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("transactionsPage.fixedItemLabel", { name })}
      className="-m-1 inline-flex min-h-11 items-center rounded-full p-1 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <Badge variant="outline" className="text-muted-foreground">
        <Repeat />
        <span className="max-w-40 truncate">{name}</span>
      </Badge>
    </button>
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
          className="size-8 text-muted-foreground hover:text-foreground md:size-6"
        >
          <Repeat className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{name}</TooltipContent>
    </Tooltip>
  )
}
