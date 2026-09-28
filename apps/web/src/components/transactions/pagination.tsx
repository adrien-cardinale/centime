import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

type PaginationProps = {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
}

export function Pagination({ page, pageCount, onPageChange }: PaginationProps) {
  return (
    <div className="flex items-center justify-between gap-4 border-t px-6 py-3">
      <p className="text-sm text-muted-foreground">
        Page {page} sur {pageCount}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft />
          Précédent
        </Button>
        <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
          Suivant
          <ChevronRight />
        </Button>
      </div>
    </div>
  )
}
