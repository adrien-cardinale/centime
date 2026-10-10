import { Amount } from "@/components/amount"
import { FIXED_ITEM_CURRENCY } from "@/lib/fixed-items"
import { Deviation } from "./deviation"
import { MonthDue } from "./month-due"
import type { MonthRow } from "./month-rows"

type FixedItemCardsProps = {
  rows: MonthRow[]
  onView: (id: string) => void
}

export function FixedItemCards({ rows, onView }: FixedItemCardsProps) {
  return (
    <ul className="divide-y">
      {rows.map((row) => (
        <li key={row.item.id}>
          <FixedItemCard row={row} onView={onView} />
        </li>
      ))}
    </ul>
  )
}

function FixedItemCard({ row, onView }: { row: MonthRow; onView: (id: string) => void }) {
  const { item, occurrence } = row
  return (
    <button
      type="button"
      onClick={() => onView(item.id)}
      className="flex min-h-11 w-full flex-col gap-1.5 px-4 py-3 text-left text-sm hover:bg-muted/50 active:bg-muted"
    >
      <span className="flex w-full items-baseline justify-between gap-3">
        <span className="line-clamp-1 min-w-0 font-medium">{item.name}</span>
        <Amount amount={item.expectedAmount} currency={FIXED_ITEM_CURRENCY} className="shrink-0" />
      </span>
      <span className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <MonthDue row={row} />
        {occurrence && occurrence.actualAmount !== null && (
          <span className="flex items-center gap-2">
            <Deviation report={occurrence} />
            <Amount amount={occurrence.actualAmount} currency={FIXED_ITEM_CURRENCY} />
          </span>
        )}
      </span>
    </button>
  )
}
