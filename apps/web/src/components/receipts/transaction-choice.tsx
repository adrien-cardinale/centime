import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Amount } from "@/components/amount"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/format"

export type LinkableTransaction = {
  id: string
  bookingDate: string
  rawLabel: string
  amount: number
  currency: string
}

type TransactionChoiceProps = {
  transaction: LinkableTransaction
  badge?: ReactNode
  disabled: boolean
  onLink: (transactionId: string) => void
}

export function TransactionChoice({ transaction, badge, disabled, onLink }: TransactionChoiceProps) {
  const { t } = useTranslation()
  return (
    <li className="flex items-center gap-3 px-3 py-2">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="line-clamp-2 text-sm break-words">{transaction.rawLabel}</p>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground tabular-nums">
          <span>{formatDate(transaction.bookingDate)}</span>
          <Amount amount={transaction.amount} currency={transaction.currency} />
          {badge}
        </div>
      </div>
      <Button type="button" size="sm" className="min-h-10 md:min-h-8" disabled={disabled} onClick={() => onLink(transaction.id)}>
        {t("receipts.link.link")}
      </Button>
    </li>
  )
}
