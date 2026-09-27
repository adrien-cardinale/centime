import { Card, CardContent } from "@/components/ui/card"
import type { ImportPreview } from "@/lib/api"
import { cn } from "@/lib/utils"

type SummaryItem = { label: string; value: number; tone?: "muted" | "destructive" }

function summaryItems(summary: ImportPreview["summary"]): SummaryItem[] {
  return [
    { label: "Total", value: summary.total },
    { label: "Nouvelles", value: summary.new },
    { label: "Doublons", value: summary.duplicates, tone: "muted" },
    { label: "Mises à jour", value: summary.pendingToBooked },
    { label: "Erreurs", value: summary.errors, tone: summary.errors > 0 ? "destructive" : "muted" },
  ]
}

export function ImportSummary({ summary }: { summary: ImportPreview["summary"] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {summaryItems(summary).map((item) => (
        <Card key={item.label} className="gap-1 py-4">
          <CardContent className="px-4">
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p
              className={cn(
                "text-2xl font-semibold tabular-nums",
                item.tone === "muted" && "text-muted-foreground",
                item.tone === "destructive" && "text-destructive",
              )}
            >
              {item.value}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
