import type { ReactNode } from "react"
import { useIsMobile } from "@/hooks/use-mobile"
import { MobileTransactionFilters } from "./mobile-transaction-filters"
import { TransactionFilterFields, type TransactionFilterFieldsProps } from "./transaction-filter-fields"

export type { TransactionFilterValues } from "./transaction-filter-fields"

export type TransactionFiltersProps = TransactionFilterFieldsProps & {
  actions?: ReactNode
}

export function TransactionFilters({ values, onChange, actions }: TransactionFiltersProps) {
  const isMobile = useIsMobile()
  if (isMobile) return <MobileTransactionFilters values={values} onChange={onChange} actions={actions} />
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <TransactionFilterFields values={values} onChange={onChange} />
      {actions && <div className="flex flex-wrap items-end justify-end gap-2">{actions}</div>}
    </div>
  )
}
