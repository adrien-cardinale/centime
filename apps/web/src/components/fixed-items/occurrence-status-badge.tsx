import type { OccurrenceStatus } from "@centime/core"
import { Badge } from "@/components/ui/badge"
import { occurrenceStatusLabels } from "@/lib/labels"
import { cn } from "@/lib/utils"

const statusClasses: Record<OccurrenceStatus, string> = {
  paid: "border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  upcoming: "text-muted-foreground",
  due: "border-amber-600/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  overdue: "border-destructive/30 bg-destructive/10 text-destructive",
}

export function OccurrenceStatusBadge({ status, className }: { status: OccurrenceStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn(statusClasses[status], className)}>
      {occurrenceStatusLabels[status]}
    </Badge>
  )
}
