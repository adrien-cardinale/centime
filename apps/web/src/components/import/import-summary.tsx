import type { TFunction } from "i18next"
import { useTranslation } from "react-i18next"
import { Card, CardContent } from "@/components/ui/card"
import type { ImportPreview } from "@/lib/api"
import { cn } from "@/lib/utils"

type SummaryItem = { label: string; value: number; tone?: "muted" | "destructive" }

function summaryItems(summary: ImportPreview["summary"], t: TFunction): SummaryItem[] {
  return [
    { label: t("importWorkspace.summary.total"), value: summary.total },
    { label: t("importWorkspace.summary.new"), value: summary.new },
    { label: t("importWorkspace.summary.duplicates"), value: summary.duplicates, tone: "muted" },
    { label: t("importWorkspace.summary.updated"), value: summary.pendingToBooked },
    { label: t("importWorkspace.summary.errors"), value: summary.errors, tone: summary.errors > 0 ? "destructive" : "muted" },
  ]
}

export function ImportSummary({ summary }: { summary: ImportPreview["summary"] }) {
  const { t } = useTranslation()
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {summaryItems(summary, t).map((item) => (
        <Card key={item.label} className="gap-1 py-4">
          <CardContent className="px-4">
            <p className="text-sm text-muted-foreground">{item.label}</p>
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
