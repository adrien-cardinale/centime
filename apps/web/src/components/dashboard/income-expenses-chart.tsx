import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { MonthlyPoint } from "@/lib/api"
import { CHART_HEIGHT_CLASS, compactAmount, money, shortMonth } from "@/lib/dashboard"
import { cn } from "@/lib/utils"
import { ChartCard } from "./chart-card"

const chartConfig = {
  income: { label: "Revenus", color: "var(--chart-income)" },
  expenses: { label: "Dépenses", color: "var(--chart-expenses)" },
} satisfies ChartConfig

export function IncomeExpensesChart({ series }: { series: MonthlyPoint[] }) {
  const labels = new Map(series.map((point) => [point.month, point.label]))
  return (
    <ChartCard
      title="Revenus et dépenses, 12 derniers mois"
      description="Transactions comptabilisées, hors transferts."
      chart={
        <ChartContainer config={chartConfig} className={cn("aspect-auto w-full", CHART_HEIGHT_CLASS)}>
          <BarChart data={series} barGap={2} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="month" tickFormatter={shortMonth} axisLine={false} tickLine={false} tickMargin={8} minTickGap={4} />
            <YAxis tickFormatter={compactAmount} axisLine={false} tickLine={false} width={44} />
            <ChartTooltip
              cursor={{ fill: "var(--muted)", opacity: 0.5 }}
              content={
                <ChartTooltipContent
                  valueFormatter={money}
                  labelFormatter={(value) => labels.get(String(value)) ?? String(value)}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="income" fill="var(--color-income)" radius={[4, 4, 0, 0]} maxBarSize={16} />
            <Bar dataKey="expenses" fill="var(--color-expenses)" radius={[4, 4, 0, 0]} maxBarSize={16} />
          </BarChart>
        </ChartContainer>
      }
      table={<MonthlyTable series={series} />}
    />
  )
}

function MonthlyTable({ series }: { series: MonthlyPoint[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Mois</TableHead>
          <TableHead className="text-right">Revenus</TableHead>
          <TableHead className="text-right">Dépenses</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {series.map((point) => (
          <TableRow key={point.month}>
            <TableCell>{point.label}</TableCell>
            <TableCell className="text-right tabular-nums">{money(point.income)}</TableCell>
            <TableCell className="text-right tabular-nums">{money(point.expenses)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
