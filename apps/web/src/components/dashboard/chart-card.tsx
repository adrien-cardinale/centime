import { ChartColumn, Table2 } from "lucide-react"
import { type ReactNode, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type ChartCardProps = {
  title: string
  description?: string
  chart: ReactNode
  table?: ReactNode
  className?: string
}

export function ChartCard({ title, description, chart, table, className }: ChartCardProps) {
  const [showTable, setShowTable] = useState(false)
  const tableVisible = showTable && table !== undefined
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        {table !== undefined && (
          <CardAction>
            <ViewToggle showTable={showTable} onToggle={() => setShowTable((current) => !current)} />
          </CardAction>
        )}
      </CardHeader>
      <CardContent>{tableVisible ? <div className="sm:max-h-[260px] sm:overflow-y-auto">{table}</div> : chart}</CardContent>
    </Card>
  )
}

function ViewToggle({ showTable, onToggle }: { showTable: boolean; onToggle: () => void }) {
  const { t } = useTranslation()
  const label = showTable ? t("dashboardPage.chartView") : t("dashboardPage.tableView")
  return (
    <Button variant="ghost" size="sm" className="min-w-10" aria-pressed={showTable} aria-label={label} onClick={onToggle}>
      {showTable ? <ChartColumn /> : <Table2 />}
      <span className="sr-only sm:not-sr-only">{label}</span>
    </Button>
  )
}
