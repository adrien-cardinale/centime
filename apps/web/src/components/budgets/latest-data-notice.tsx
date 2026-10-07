import { type PeriodRange, periodContaining } from "@centime/core"
import { useQuery } from "@tanstack/react-query"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/format"
import { transactionsQuery } from "@/lib/queries"

const LATEST_TRANSACTION = { page: 1, pageSize: 1 }

type LatestDataNoticeProps = {
  month: PeriodRange
  onSelect: (date: string) => void
}

export function LatestDataNotice({ month, onSelect }: LatestDataNoticeProps) {
  const { data } = useQuery(transactionsQuery(LATEST_TRANSACTION))
  const latest = data?.items[0]?.bookingDate
  if (latest === undefined || latest >= month.start) return null
  return (
    <Alert className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <AlertDescription className="text-foreground">
        Aucune transaction en {month.label.toLowerCase()} : la plus récente date du {formatDate(latest)}.
      </AlertDescription>
      <Button variant="outline" size="sm" onClick={() => onSelect(latest)}>
        Voir {periodContaining("monthly", latest).label.toLowerCase()}
      </Button>
    </Alert>
  )
}
