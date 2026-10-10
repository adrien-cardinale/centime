import { Link } from "@tanstack/react-router"
import type { CategoryBreakdownEntry } from "@/lib/api"
import { wholeMoney } from "@/lib/dashboard"
import { entryKey, isNamedEntry, type MonthRange, transactionsSearchOf } from "./category-breakdown"

type CategoryBreakdownListProps = { entries: CategoryBreakdownEntry[]; month: MonthRange }

const rowClassName = "-mx-2 flex min-h-11 flex-col justify-center gap-1.5 rounded-md px-2 py-1.5"

export function CategoryBreakdownList({ entries, month }: CategoryBreakdownListProps) {
  const largest = Math.max(...entries.map((entry) => entry.amount), 0)
  return (
    <ul className="space-y-1">
      {entries.map((entry) => {
        const search = transactionsSearchOf(entry, month)
        const content = <BreakdownRowContent entry={entry} largest={largest} />
        return (
          <li key={entryKey(entry)}>
            {search ? (
              <Link to="/transactions" search={search} className={`${rowClassName} hover:bg-muted/50`}>
                {content}
              </Link>
            ) : (
              <div className={rowClassName}>{content}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function BreakdownRowContent({ entry, largest }: { entry: CategoryBreakdownEntry; largest: number }) {
  const width = largest > 0 ? (entry.amount / largest) * 100 : 0
  const color = isNamedEntry(entry) ? "var(--chart-neutral)" : "var(--chart-muted)"
  return (
    <>
      <span className="flex items-baseline justify-between gap-3 text-sm">
        <span className="truncate">{entry.name}</span>
        <span className="shrink-0 tabular-nums">{wholeMoney(entry.amount)}</span>
      </span>
      <span className="block h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
        <span className="block h-full rounded-full" style={{ width: `${width}%`, backgroundColor: color }} />
      </span>
    </>
  )
}
