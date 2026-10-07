import { useTranslation } from "react-i18next"
import { Amount } from "@/components/amount"
import { CategoryBadge } from "@/components/categories/category-badge"
import type { TransactionItem } from "@/lib/api"
import { formatDate } from "@/lib/format"
import { SummaryCard } from "./summary-card"

export function RecentTransactionsCard({ transactions }: { transactions: TransactionItem[] }) {
  const { t } = useTranslation()
  return (
    <SummaryCard
      title={t("dashboardPage.recent.title")}
      to="/transactions"
      isEmpty={transactions.length === 0}
      emptyMessage={t("dashboardPage.recent.empty")}
    >
      <ul className="divide-y">
        {transactions.map((transaction) => (
          <li
            key={transaction.id}
            className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1 py-2 text-sm first:pt-0 last:pb-0"
          >
            <span className="text-muted-foreground tabular-nums">{formatDate(transaction.bookingDate)}</span>
            <span className="truncate" title={transaction.rawLabel}>
              {transaction.merchant ?? transaction.rawLabel}
            </span>
            <Amount amount={transaction.amount} currency={transaction.currency} className="text-right" />
            <span className="col-start-2 min-w-0">
              {transaction.categoryName && transaction.categoryColor ? (
                <CategoryBadge name={transaction.categoryName} color={transaction.categoryColor} />
              ) : (
                <span className="text-xs text-muted-foreground">{t("dashboardPage.recent.uncategorized")}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </SummaryCard>
  )
}
