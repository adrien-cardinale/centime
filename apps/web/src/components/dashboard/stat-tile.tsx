import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react"
import type { ReactNode } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatPercent, relativeChange } from "@/lib/dashboard"

type StatTileProps = {
  label: string
  value: string
  marker?: ReactNode
  footer: ReactNode
}

export function StatTile({ label, value, marker, footer }: StatTileProps) {
  return (
    <Card className="gap-1 py-4">
      <CardHeader className="gap-1 px-4">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="flex items-center gap-2 text-2xl tabular-nums">
          <span className="truncate">{value}</span>
          {marker}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 text-xs text-muted-foreground">{footer}</CardContent>
    </Card>
  )
}

export function MonthDelta({ current, previous }: { current: number; previous: number }) {
  const change = relativeChange(current, previous)
  if (change === null) return <span>Pas de comparaison avec le mois précédent</span>
  const Icon = change > 0 ? ArrowUp : change < 0 ? ArrowDown : ArrowRight
  const direction = change > 0 ? "hausse" : change < 0 ? "baisse" : "stable"
  return (
    <span className="inline-flex items-center gap-1 tabular-nums">
      <Icon className="size-3" aria-hidden />
      <span className="sr-only">{direction}</span>
      {formatPercent(change)} vs mois précédent
    </span>
  )
}

export function NegativeMarker() {
  return (
    <span className="inline-flex items-center" title="Solde négatif">
      <span className="size-2 rounded-full bg-destructive/70" aria-hidden />
      <span className="sr-only">Négatif</span>
    </span>
  )
}
