import { ListFilter } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import type { TransactionFiltersProps } from "./transaction-filters"
import { activeFilterCount, NO_FILTERS, TransactionFilterFields } from "./transaction-filter-fields"

export function MobileTransactionFilters({ values, onChange, actions }: TransactionFiltersProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const activeCount = activeFilterCount(values)

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline">
            <ListFilter />
            {t("transactionsPage.filters.toggle")}
            {activeCount > 0 && <Badge className="px-1.5">{activeCount}</Badge>}
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" aria-describedby={undefined}>
          <SheetHeader className="pr-14">
            <SheetTitle>{t("transactionsPage.filters.toggle")}</SheetTitle>
          </SheetHeader>
          <div className="grid gap-4 px-4">
            <TransactionFilterFields values={values} onChange={onChange} />
          </div>
          <SheetFooter className="flex-row">
            <Button variant="outline" className="flex-1" disabled={activeCount === 0} onClick={() => onChange(NO_FILTERS)}>
              {t("transactionsPage.filters.reset")}
            </Button>
            <Button className="flex-1" onClick={() => setOpen(false)}>
              {t("transactionsPage.filters.showResults")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
