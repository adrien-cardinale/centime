import { useQuery } from "@tanstack/react-query"
import { Search } from "lucide-react"
import { type ReactNode, useState } from "react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useLinkReceipt } from "@/hooks/use-receipt-updates"
import type { Receipt } from "@/lib/api"
import { receiptCandidatesQuery } from "@/lib/queries"
import { matchLevelOf } from "./receipt-lines"
import { TransactionChoice } from "./transaction-choice"
import { TransactionSearch } from "./transaction-search"

const MAX_CANDIDATES = 5

type ReceiptLinkPanelProps = {
  receipt: Receipt
  onLinked: (receipt: Receipt) => void
  actions: ReactNode
}

export function ReceiptLinkPanel({ receipt, onLinked, actions }: ReceiptLinkPanelProps) {
  const { t } = useTranslation()
  const [searching, setSearching] = useState(false)
  const link = useLinkReceipt(onLinked)
  const linkTo = (transactionId: string) => link.mutate({ id: receipt.id, transactionId })

  return (
    <div className="space-y-4">
      {searching ? (
        <TransactionSearch receipt={receipt} disabled={link.isPending} onLink={linkTo} />
      ) : (
        <Candidates receipt={receipt} disabled={link.isPending} onLink={linkTo} />
      )}
      <Button type="button" variant="link" className="h-auto px-0" onClick={() => setSearching((current) => !current)}>
        <Search />
        {searching ? t("receipts.link.showCandidates") : t("receipts.link.searchOther")}
      </Button>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{actions}</div>
    </div>
  )
}

type CandidatesProps = {
  receipt: Receipt
  disabled: boolean
  onLink: (transactionId: string) => void
}

function Candidates({ receipt, disabled, onLink }: CandidatesProps) {
  const { t } = useTranslation()
  const { data, isPending, error } = useQuery(receiptCandidatesQuery(receipt.id))
  if (isPending) return <Skeleton className="h-16 w-full" />
  if (error) return <p className="text-sm text-destructive">{error.message}</p>
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {receipt.total === null ? t("receipts.link.needsTotal") : t("receipts.link.noCandidates")}
      </p>
    )
  }
  return (
    <ul className="divide-y rounded-md border">
      {data.slice(0, MAX_CANDIDATES).map((candidate) => (
        <TransactionChoice
          key={candidate.transactionId}
          transaction={{ ...candidate, id: candidate.transactionId }}
          badge={<Badge variant="outline">{t(`receipts.link.level.${matchLevelOf(candidate.score)}`)}</Badge>}
          disabled={disabled}
          onLink={onLink}
        />
      ))}
    </ul>
  )
}
