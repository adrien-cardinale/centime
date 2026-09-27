import { Link, useNavigate } from "@tanstack/react-router"
import { Bar, BarChart, Cell, LabelList, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { type CategoryBreakdownEntry, UNCATEGORIZED_FILTER } from "@/lib/api"
import { CATEGORY_LABEL_MAX_LENGTH, CHART_HEIGHT_CLASS, money, truncateLabel, wholeMoney } from "@/lib/dashboard"
import { cn } from "@/lib/utils"
import { ChartCard } from "./chart-card"

const TITLE = "Dépenses par catégorie"
const CATEGORY_AXIS_WIDTH = 116
const VALUE_LABEL_WIDTH = 76

const chartConfig = {
  amount: { label: "Dépenses", color: "var(--chart-neutral)" },
} satisfies ChartConfig

type MonthRange = { start: string; end: string; label: string }

type TransactionsSearch = { categoryId: string; from: string; to: string; includeChildren?: true }

function transactionsSearchOf(entry: CategoryBreakdownEntry, month: MonthRange): TransactionsSearch | null {
  if (entry.kind === "uncategorized") return { categoryId: UNCATEGORIZED_FILTER, from: month.start, to: month.end }
  if (entry.kind === "category" && entry.categoryId !== null) {
    return { categoryId: entry.categoryId, from: month.start, to: month.end, includeChildren: true }
  }
  return null
}

function barFill(entry: CategoryBreakdownEntry): string {
  return entry.kind === "category" ? "var(--color-amount)" : "var(--chart-muted)"
}

type CategoryBreakdownChartProps = { entries: CategoryBreakdownEntry[]; month: MonthRange }

export function CategoryBreakdownChart({ entries, month }: CategoryBreakdownChartProps) {
  const navigate = useNavigate()
  const description = `${month.label}, transactions comptabilisées hors transferts.`
  if (entries.length === 0) return <EmptyBreakdown description={description} />
  const data = entries.map((entry) => ({ ...entry, fill: barFill(entry) }))
  const openTransactions = (index: number) => {
    const entry = entries[index]
    const search = entry ? transactionsSearchOf(entry, month) : null
    if (search) void navigate({ to: "/transactions", search })
  }
  return (
    <ChartCard
      title={TITLE}
      description={description}
      chart={
        <ChartContainer config={chartConfig} className={cn("aspect-auto w-full", CHART_HEIGHT_CLASS)}>
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: VALUE_LABEL_WIDTH, bottom: 0, left: 0 }}>
            <XAxis type="number" dataKey="amount" hide />
            <YAxis
              type="category"
              dataKey="name"
              width={CATEGORY_AXIS_WIDTH}
              axisLine={false}
              tickLine={false}
              tick={<CategoryTick />}
            />
            <ChartTooltip cursor={{ fill: "var(--muted)", opacity: 0.5 }} content={<ChartTooltipContent valueFormatter={money} />} />
            <Bar
              dataKey="amount"
              radius={[0, 4, 4, 0]}
              maxBarSize={18}
              className="cursor-pointer"
              onClick={(_, index) => openTransactions(index)}
            >
              {data.map((entry) => (
                <Cell key={`${entry.kind}-${entry.categoryId ?? entry.name}`} fill={entry.fill} />
              ))}
              <LabelList
                dataKey="amount"
                position="right"
                offset={8}
                className="fill-foreground tabular-nums"
                formatter={(value) => (typeof value === "number" ? wholeMoney(value) : value)}
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      }
      table={<BreakdownTable entries={entries} month={month} />}
    />
  )
}

type CategoryTickProps = { x?: number | string; y?: number | string; payload?: { value?: unknown } }

function CategoryTick({ x, y, payload }: CategoryTickProps) {
  const name = String(payload?.value ?? "")
  const text = (
    <text x={x} y={y} dx={-8} dy={4} textAnchor="end" className="fill-muted-foreground text-xs">
      {truncateLabel(name)}
    </text>
  )
  if (name.length <= CATEGORY_LABEL_MAX_LENGTH) return text
  return (
    <Tooltip>
      <TooltipTrigger asChild>{text}</TooltipTrigger>
      <TooltipContent>{name}</TooltipContent>
    </Tooltip>
  )
}

function EmptyBreakdown({ description }: { description: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{TITLE}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
          Aucune dépense ce mois-ci.
        </p>
      </CardContent>
    </Card>
  )
}

function BreakdownTable({ entries, month }: CategoryBreakdownChartProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Catégorie</TableHead>
          <TableHead className="text-right">Dépenses</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => {
          const search = transactionsSearchOf(entry, month)
          return (
            <TableRow key={`${entry.kind}-${entry.categoryId ?? entry.name}`}>
              <TableCell className="max-w-48 truncate">
                {search ? (
                  <Link to="/transactions" search={search} className="underline-offset-4 hover:underline">
                    {entry.name}
                  </Link>
                ) : (
                  entry.name
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">{money(entry.amount)}</TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
