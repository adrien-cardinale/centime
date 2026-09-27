import { shiftDays } from "@centime/core"
import { format, parseISO } from "date-fns"
import { fr } from "date-fns/locale"
import { Amount } from "@/components/amount"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { FixedItem, FixedItemOverview, OccurrenceReport } from "@/lib/api"
import { FIXED_ITEM_CURRENCY } from "@/lib/fixed-items"
import { formatDate } from "@/lib/format"
import { OccurrenceStatusBadge } from "./occurrence-status-badge"

const HORIZON_DAYS = 90

type UpcomingEntry = { report: OccurrenceReport; name: string }
type MonthGroup = { label: string; entries: UpcomingEntry[] }

type UpcomingOccurrencesProps = {
  items: FixedItem[]
  overviews: FixedItemOverview[]
  today: string
  onView: (id: string) => void
}

function isPending(report: OccurrenceReport, horizon: string): boolean {
  return (report.status === "due" || report.status === "upcoming") && report.dueDate <= horizon
}

function upcomingEntries(items: FixedItem[], overviews: FixedItemOverview[], today: string): UpcomingEntry[] {
  const names = new Map(items.map((item) => [item.id, item.name]))
  const horizon = shiftDays(today, HORIZON_DAYS)
  return overviews
    .flatMap((overview) =>
      overview.occurrences
        .filter((report) => isPending(report, horizon))
        .map((report) => ({ report, name: names.get(overview.fixedItemId) ?? "" })),
    )
    .sort((left, right) => left.report.dueDate.localeCompare(right.report.dueDate))
}

function monthLabel(isoDate: string): string {
  const label = format(parseISO(isoDate), "LLLL yyyy", { locale: fr })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function groupByMonth(entries: UpcomingEntry[]): MonthGroup[] {
  const groups = new Map<string, MonthGroup>()
  for (const entry of entries) {
    const key = entry.report.dueDate.slice(0, 7)
    const group = groups.get(key) ?? { label: monthLabel(entry.report.dueDate), entries: [] }
    group.entries.push(entry)
    groups.set(key, group)
  }
  return [...groups.values()]
}

export function UpcomingOccurrences({ items, overviews, today, onView }: UpcomingOccurrencesProps) {
  const groups = groupByMonth(upcomingEntries(items, overviews, today))
  return (
    <Card>
      <CardHeader>
        <CardTitle>Échéances à venir</CardTitle>
        <CardDescription>Échéances non réglées des {HORIZON_DAYS} prochains jours.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {groups.length === 0 && <p className="text-sm text-muted-foreground">Aucune échéance à venir.</p>}
        {groups.map((group) => (
          <section key={group.label} className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">{group.label}</h3>
            <ul className="divide-y rounded-md border">
              {group.entries.map(({ report, name }) => (
                <li key={`${report.fixedItemId}-${report.dueDate}`}>
                  <button
                    type="button"
                    onClick={() => onView(report.fixedItemId)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted/50"
                  >
                    <span className="w-24 tabular-nums">{formatDate(report.dueDate)}</span>
                    <span className="truncate font-medium">{name}</span>
                    <OccurrenceStatusBadge status={report.status} />
                    <Amount amount={report.expectedAmount} currency={FIXED_ITEM_CURRENCY} className="ml-auto" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </CardContent>
    </Card>
  )
}
