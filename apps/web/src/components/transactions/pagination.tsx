import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"

type PaginationProps = {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
}

export function Pagination({ page, pageCount, onPageChange }: PaginationProps) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t px-4 py-3 sm:px-6">
      <p className="text-sm text-muted-foreground">
        {t("transactionsPage.pagination.pageOf", { page, pageCount })}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={t("transactionsPage.pagination.first")}
          disabled={page <= 1}
          onClick={() => onPageChange(1)}
        >
          <ChevronsLeft />
        </Button>
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft />
          <span className="max-sm:sr-only">{t("transactionsPage.pagination.previous")}</span>
        </Button>
        <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
          <span className="max-sm:sr-only">{t("transactionsPage.pagination.next")}</span>
          <ChevronRight />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={t("transactionsPage.pagination.last")}
          disabled={page >= pageCount}
          onClick={() => onPageChange(pageCount)}
        >
          <ChevronsRight />
        </Button>
      </div>
    </div>
  )
}
