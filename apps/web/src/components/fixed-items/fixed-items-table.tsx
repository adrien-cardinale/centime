import type { PeriodRange } from "@centime/core"
import { Eye, Pencil } from "lucide-react"
import { Amount } from "@/components/amount"
import { CategoryBadge } from "@/components/categories/category-badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { FixedItem, FixedItemOverview, OccurrenceReport } from "@/lib/api"
import { dueDescription, FIXED_ITEM_CURRENCY, occurrenceIn } from "@/lib/fixed-items"
import { formatDate } from "@/lib/format"
import { Deviation } from "./deviation"
import { DeleteFixedItemButton } from "./delete-fixed-item-button"
import { FixedItemDialog } from "./fixed-item-dialog"
import { OccurrenceStatusBadge } from "./occurrence-status-badge"

type FixedItemsTableProps = {
  items: FixedItem[]
  overviews: Map<string, FixedItemOverview>
  month: PeriodRange
  emptyMessage: string
  onView: (id: string) => void
}

type MonthRow = {
  item: FixedItem
  occurrence: OccurrenceReport | undefined
  next: OccurrenceReport | null
}

function byDueDate(left: MonthRow, right: MonthRow): number {
  if (left.occurrence && right.occurrence) return left.occurrence.dueDate.localeCompare(right.occurrence.dueDate)
  return Number(right.occurrence !== undefined) - Number(left.occurrence !== undefined)
}

function monthRows(items: FixedItem[], overviews: Map<string, FixedItemOverview>, month: PeriodRange): MonthRow[] {
  return items
    .map((item) => {
      const overview = overviews.get(item.id)
      return { item, occurrence: occurrenceIn(overview?.occurrences ?? [], month), next: overview?.nextOccurrence ?? null }
    })
    .sort(byDueDate)
}

export function FixedItemsTable({ items, overviews, month, emptyMessage, onView }: FixedItemsTableProps) {
  if (items.length === 0) {
    return <p className="p-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-6">Nom</TableHead>
          <TableHead>Catégorie</TableHead>
          <TableHead>Périodicité</TableHead>
          <TableHead className="text-right">Attendu</TableHead>
          <TableHead>Échéance du mois</TableHead>
          <TableHead className="text-right">Réel</TableHead>
          <TableHead className="pr-6 text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {monthRows(items, overviews, month).map((row) => (
          <FixedItemRow key={row.item.id} row={row} onView={onView} />
        ))}
      </TableBody>
    </Table>
  )
}

type FixedItemRowProps = {
  row: MonthRow
  onView: (id: string) => void
}

function FixedItemRow({ row, onView }: FixedItemRowProps) {
  const { item, occurrence, next } = row
  return (
    <TableRow className="cursor-pointer" onClick={() => onView(item.id)}>
      <TableCell className="max-w-56 truncate pl-6 font-medium" title={item.name}>
        {item.name}
      </TableCell>
      <TableCell>
        {item.categoryName && item.categoryColor ? (
          <CategoryBadge name={item.categoryName} color={item.categoryColor} />
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground">{dueDescription(item)}</TableCell>
      <TableCell className="text-right">
        <Amount amount={item.expectedAmount} currency={FIXED_ITEM_CURRENCY} />
      </TableCell>
      <TableCell>
        {occurrence ? (
          <div className="flex items-center gap-2">
            <span className="tabular-nums">{formatDate(occurrence.dueDate)}</span>
            <OccurrenceStatusBadge status={occurrence.status} />
          </div>
        ) : (
          <span className="text-muted-foreground">
            {next ? `Prochaine le ${formatDate(next.dueDate)}` : "Aucune échéance"}
          </span>
        )}
      </TableCell>
      <TableCell className="text-right">
        {occurrence && occurrence.actualAmount !== null ? (
          <div className="flex items-center justify-end gap-2">
            <Deviation report={occurrence} />
            <Amount amount={occurrence.actualAmount} currency={FIXED_ITEM_CURRENCY} />
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="pr-6" onClick={(event) => event.stopPropagation()}>
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" aria-label={`Voir ${item.name}`} onClick={() => onView(item.id)}>
            <Eye />
          </Button>
          <FixedItemDialog
            item={item}
            trigger={
              <Button variant="ghost" size="icon" aria-label={`Modifier ${item.name}`}>
                <Pencil />
              </Button>
            }
          />
          <DeleteFixedItemButton item={item} />
        </div>
      </TableCell>
    </TableRow>
  )
}
