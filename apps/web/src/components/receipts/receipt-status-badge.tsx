import type { ReceiptStatus } from "@centime/core"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"

const VARIANTS = { pending: "outline", linked: "secondary", ignored: "outline" } as const

export function ReceiptStatusBadge({ status }: { status: ReceiptStatus }) {
  const { t } = useTranslation()
  return (
    <Badge variant={VARIANTS[status]} className={status === "ignored" ? "text-muted-foreground" : undefined}>
      {t(`receipts.status.${status}`)}
    </Badge>
  )
}
