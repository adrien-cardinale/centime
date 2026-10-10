import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { Amount } from "@/components/amount"
import { CategoryBadge } from "@/components/categories/category-badge"
import { Badge } from "@/components/ui/badge"
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
          <li key={transaction.id} className="py-1 first:pt-0 last:pb-0">
            <Link
              to="/transactions"
              search={{ from: transaction.bookingDate, to: transaction.bookingDate }}
              className="-mx-2 grid min-h-11 grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1 rounded-md px-2 py-1 text-sm hover:bg-muted/50"
            >
              <span className="text-muted-foreground tabular-nums">{formatDate(transaction.bookingDate)}</span>
              <span className="truncate">{transaction.merchant ?? transaction.rawLabel}</span>
              <Amount amount={transaction.amount} currency={transaction.currency} className="text-right" />
              <span className="col-start-2 min-w-0">
                <RecentCategory transaction={transaction} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </SummaryCard>
  )
}

function RecentCategory({ transaction }: { transaction: TransactionItem }) {
  const { t } = useTranslation()
  if (transaction.isSplit) return <Badge variant="outline">{t("transactionsPage.split.badge")}</Badge>
  if (transaction.categoryName && transaction.categoryColor) {
    return <CategoryBadge name={transaction.categoryName} color={transaction.categoryColor} />
  }
  return <span className="text-xs text-muted-foreground">{t("dashboardPage.recent.uncategorized")}</span>
}
