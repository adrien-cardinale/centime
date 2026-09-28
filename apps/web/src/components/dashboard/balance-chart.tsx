import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { BalancePoint } from "@/lib/api"
import { CHART_HEIGHT_CLASS, compactAmount, money, shortMonth } from "@/lib/dashboard"
import { cn } from "@/lib/utils"
import { ChartCard } from "./chart-card"

const TITLE = "Solde bancaire"
const DESCRIPTION = "Fin de mois, somme des comptes bancaires."

const chartConfig = {
  balance: { label: "Solde", color: "var(--chart-neutral)" },
} satisfies ChartConfig

export function BalanceChart({ series }: { series: BalancePoint[] }) {
  if (series.length === 0) return <EmptyBalance />
  const labels = new Map(series.map((point) => [point.month, point.label]))
  return (
    <ChartCard
      title={TITLE}
      description={DESCRIPTION}
      chart={
        <ChartContainer config={chartConfig} className={cn("aspect-auto w-full", CHART_HEIGHT_CLASS)}>
          <LineChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="month" tickFormatter={shortMonth} axisLine={false} tickLine={false} tickMargin={8} minTickGap={4} />
            <YAxis
              tickFormatter={compactAmount}
              axisLine={false}
              tickLine={false}
              width={44}
              domain={["auto", "auto"]}
            />
            <ChartTooltip
              cursor={{ stroke: "var(--border)" }}
              content={
                <ChartTooltipContent
                  indicator="line"
                  valueFormatter={money}
                  labelFormatter={(value) => labels.get(String(value)) ?? String(value)}
                />
              }
            />
            <Line
              dataKey="balance"
              type="monotone"
              stroke="var(--color-balance)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          </LineChart>
        </ChartContainer>
      }
      table={<BalanceTable series={series} />}
    />
  )
}

function EmptyBalance() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{TITLE}</CardTitle>
        <CardDescription>{DESCRIPTION}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="flex h-[240px] items-center justify-center text-center text-sm text-muted-foreground">
          Aucun solde disponible, importe un relevé bancaire.
        </p>
      </CardContent>
    </Card>
  )
}

function BalanceTable({ series }: { series: BalancePoint[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Mois</TableHead>
          <TableHead className="text-right">Solde</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {series.map((point) => (
          <TableRow key={point.month}>
            <TableCell>{point.label}</TableCell>
            <TableCell className="text-right tabular-nums">{money(point.balance)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
