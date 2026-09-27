import type { OccurrenceReport } from "@/lib/api"
import { isDeviationSmall } from "@/lib/fixed-items"
import { formatDecimal } from "@/lib/format"
import { cn } from "@/lib/utils"

type DeviationProps = {
  report: Pick<OccurrenceReport, "deviation" | "expectedAmount">
  className?: string
}

function signedDecimal(amount: number): string {
  return amount > 0 ? `+${formatDecimal(amount)}` : formatDecimal(amount)
}

export function Deviation({ report, className }: DeviationProps) {
  if (report.deviation === null) return <span className={cn("text-muted-foreground", className)}>—</span>
  return (
    <span
      title="Écart entre le montant réel et le montant attendu"
      className={cn(
        "tabular-nums whitespace-nowrap",
        isDeviationSmall(report) ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400",
        className,
      )}
    >
      {signedDecimal(report.deviation)}
    </span>
  )
}
