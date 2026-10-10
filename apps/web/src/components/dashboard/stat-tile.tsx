import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatPercent, relativeChange } from "@/lib/dashboard"
import { cn } from "@/lib/utils"

type StatTileProps = {
  label: string
  value: string
  negative?: boolean
  footer: ReactNode
}

export function StatTile({ label, value, negative = false, footer }: StatTileProps) {
  return (
    <Card className="min-w-0 gap-1 py-3 sm:py-4">
      <CardHeader className="gap-1 px-3 sm:px-4">
        <CardDescription className="truncate">{label}</CardDescription>
        <CardTitle className={cn("flex items-center gap-2 text-xl tabular-nums sm:text-2xl", negative && "text-destructive")}>
          <span className="truncate">{value}</span>
          {negative && <NegativeMarker />}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 text-xs text-muted-foreground sm:px-4">{footer}</CardContent>
    </Card>
  )
}

export function MonthDelta({ current, previous }: { current: number; previous: number }) {
  const { t } = useTranslation()
  const change = relativeChange(current, previous)
  if (change === null) return <span>{t("dashboardPage.delta.none")}</span>
  const Icon = change > 0 ? ArrowUp : change < 0 ? ArrowDown : ArrowRight
  const direction = change > 0 ? t("dashboardPage.delta.up") : change < 0 ? t("dashboardPage.delta.down") : t("dashboardPage.delta.stable")
  return (
    <span className="inline-flex items-center gap-1 tabular-nums">
      <Icon className="size-3" aria-hidden />
      <span className="sr-only">{direction}</span>
      {t("dashboardPage.delta.vsPrevious", { percent: formatPercent(change) })}
    </span>
  )
}

function NegativeMarker() {
  const { t } = useTranslation()
  return (
    <span role="img" aria-label={t("dashboardPage.delta.negativeBalance")} className="inline-flex shrink-0 items-center">
      <span className="size-2 rounded-full bg-destructive/70" />
    </span>
  )
}
