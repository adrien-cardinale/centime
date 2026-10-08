import { useTranslation } from "react-i18next"
import { Amount } from "@/components/amount"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import type { TransactionItem } from "@/lib/api"
import { formatDate } from "@/lib/format"
import { transactionStatusLabels } from "@/lib/labels"
import { cn } from "@/lib/utils"
import { CategoryCell } from "./category-cell"
import { FixedItemCell } from "./fixed-item-cell"
import { TransactionRowActions } from "./transaction-row-actions"

type TransactionListProps = {
  items: TransactionItem[]
  selectedIds: ReadonlySet<string>
  onToggleOne: (id: string, checked: boolean) => void
  onToggleAll: (checked: boolean) => void
  onCreateRule: (transaction: TransactionItem) => void
  linkingId: string | null
  onLinkingChange: (id: string | null) => void
}

export function TransactionList({
  items,
  selectedIds,
  onToggleOne,
  onToggleAll,
  onCreateRule,
  linkingId,
  onLinkingChange,
}: TransactionListProps) {
  const { t } = useTranslation()
  const selectedCount = items.filter((item) => selectedIds.has(item.id)).length
  const headerState = selectedCount === 0 ? false : selectedCount === items.length ? true : "indeterminate"

  return (
    <ul className="divide-y">
      <li className="flex items-center gap-3 px-4 py-2">
        <Checkbox
          className="size-5"
          aria-label={t("transactionsPage.table.selectAll")}
          checked={headerState}
          onCheckedChange={(checked) => onToggleAll(checked === true)}
        />
        <span className="text-xs text-muted-foreground">{t("transactionsPage.table.selectAll")}</span>
      </li>
      {items.map((item) => (
        <li
          key={item.id}
          className={cn("flex items-start gap-3 px-4 py-3", selectedIds.has(item.id) && "bg-muted/50")}
        >
          <Checkbox
            className="mt-0.5 size-5"
            aria-label={t("transactionsPage.table.selectOne")}
            checked={selectedIds.has(item.id)}
            onCheckedChange={(checked) => onToggleOne(item.id, checked === true)}
          />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-start justify-between gap-3">
              <span className="min-w-0 flex-1 truncate text-sm">{item.rawLabel}</span>
              <Amount amount={item.amount} currency={item.currency} className="text-sm" />
            </div>
            <p className="truncate text-xs text-muted-foreground tabular-nums">
              {formatDate(item.bookingDate)} · {item.accountName}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <CategoryCell transaction={item} onCreateRule={onCreateRule} />
              <FixedItemCell
                transaction={item}
                open={linkingId === item.id}
                onOpenChange={(open) => onLinkingChange(open ? item.id : null)}
              />
              {item.status === "pending" && <Badge variant="outline">{transactionStatusLabels[item.status]}</Badge>}
              {item.isTransfer && (
                <Badge variant="outline" className="text-muted-foreground">
                  {t("transactionsPage.table.transfer")}
                </Badge>
              )}
            </div>
          </div>
          <TransactionRowActions
            transaction={item}
            onCreateRule={onCreateRule}
            onLinkFixedItem={(transaction) => onLinkingChange(transaction.id)}
          />
        </li>
      ))}
    </ul>
  )
}
