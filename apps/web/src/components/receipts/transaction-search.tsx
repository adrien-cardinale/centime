import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import type { Receipt, TransactionItem, TransactionPageFilters } from "@/lib/api"
import { parseAmountInput } from "@/lib/format"
import { transactionsQuery } from "@/lib/queries"
import { TransactionChoice } from "./transaction-choice"

const SEARCH_DEBOUNCE_MS = 300
const NEARBY_DAYS = 10
const AMOUNT_SEARCH_DAYS = 45
const PAGE_SIZE = 50
const MAX_RESULTS = 20

type TransactionSearchProps = {
  receipt: Receipt
  disabled: boolean
  onLink: (transactionId: string) => void
}

function shiftIsoDate(date: string, days: number): string {
  const shifted = new Date(`${date}T00:00:00Z`)
  shifted.setUTCDate(shifted.getUTCDate() + days)
  return shifted.toISOString().slice(0, 10)
}

function referenceDateOf(receipt: Receipt): string {
  return receipt.receiptDate ?? receipt.capturedAt.slice(0, 10)
}

function aroundDate(date: string, days: number) {
  return { from: shiftIsoDate(date, -days), to: shiftIsoDate(date, days) }
}

function searchFilters(receipt: Receipt, text: string, amount: number | null): TransactionPageFilters {
  const base = { accountId: receipt.accountId, page: 1, pageSize: PAGE_SIZE }
  const date = referenceDateOf(receipt)
  if (amount !== null) return { ...base, ...aroundDate(date, AMOUNT_SEARCH_DAYS) }
  if (text === "") return { ...base, ...aroundDate(date, NEARBY_DAYS) }
  return { ...base, search: text }
}

function matchesAmount(transaction: TransactionItem, amount: number | null): boolean {
  if (amount === null) return true
  return Math.abs(transaction.amount).toFixed(2).startsWith(Math.abs(amount).toString())
}

export function TransactionSearch({ receipt, disabled, onLink }: TransactionSearchProps) {
  const { t } = useTranslation()
  const [text, setText] = useState("")
  const query = useDebouncedValue(text.trim(), SEARCH_DEBOUNCE_MS)
  const amount = parseAmountInput(query)
  const { data, isPending, error } = useQuery(transactionsQuery(searchFilters(receipt, query, amount)))
  const results = (data?.items ?? []).filter((item) => matchesAmount(item, amount)).slice(0, MAX_RESULTS)

  return (
    <div className="space-y-3">
      <Input
        type="search"
        autoComplete="off"
        placeholder={t("receipts.link.searchPlaceholder")}
        aria-label={t("receipts.link.searchPlaceholder")}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      {isPending && <Skeleton className="h-16 w-full" />}
      {error && <p className="text-sm text-destructive">{error.message}</p>}
      {data && results.length === 0 && <p className="text-sm text-muted-foreground">{t("receipts.link.noResults")}</p>}
      {results.length > 0 && (
        <ul className="max-h-80 divide-y overflow-y-auto rounded-md border">
          {results.map((transaction) => (
            <TransactionChoice key={transaction.id} transaction={transaction} disabled={disabled} onLink={onLink} />
          ))}
        </ul>
      )}
    </div>
  )
}
