import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import type { Receipt } from "@/lib/api"
import { formatDecimal } from "@/lib/format"
import { categoriesQuery } from "@/lib/queries"

export function ReceiptSummary({ receipt }: { receipt: Receipt }) {
  const { t } = useTranslation()
  const lines = receipt.lines ?? []
  return (
    <div className="space-y-4">
      {receipt.note && <p className="text-sm whitespace-pre-wrap">{receipt.note}</p>}
      <section className="space-y-2">
        <h3 className="text-sm font-medium">{t("receipts.details.lines")}</h3>
        {lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("receipts.details.noLines")}</p>
        ) : (
          <ReceiptLinesList lines={lines} />
        )}
      </section>
    </div>
  )
}

function ReceiptLinesList({ lines }: { lines: NonNullable<Receipt["lines"]> }) {
  const { t } = useTranslation()
  const { data: categories = [] } = useQuery(categoriesQuery)
  const categoryName = (categoryId: string | null) =>
    categories.find((category) => category.id === categoryId)?.name ?? t("receipts.details.noCategory")
  return (
    <ul className="divide-y rounded-md border text-sm">
      {lines.map((line, index) => (
        <li key={`${index}-${line.label}`} className="flex items-start justify-between gap-3 px-3 py-2">
          <div className="min-w-0">
            <p className="break-words">{line.label}</p>
            <p className="text-muted-foreground">{categoryName(line.categoryId)}</p>
          </div>
          <span className="tabular-nums">{formatDecimal(line.amount)}</span>
        </li>
      ))}
    </ul>
  )
}
