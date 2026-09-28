import { ChartColumn, Table2 } from "lucide-react"
import { type ReactNode, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type ChartCardProps = {
  title: string
  description?: string
  chart: ReactNode
  table: ReactNode
  className?: string
}

export function ChartCard({ title, description, chart, table, className }: ChartCardProps) {
  const [showTable, setShowTable] = useState(false)
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        <CardAction>
          <Button
            variant="ghost"
            size="sm"
            aria-pressed={showTable}
            onClick={() => setShowTable((current) => !current)}
          >
            {showTable ? <ChartColumn /> : <Table2 />}
            {showTable ? "Graphique" : "Tableau"}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>{showTable ? <div className="max-h-[260px] overflow-y-auto">{table}</div> : chart}</CardContent>
    </Card>
  )
}
