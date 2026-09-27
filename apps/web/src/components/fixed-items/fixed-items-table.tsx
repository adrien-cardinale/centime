import { Eye, Pencil } from "lucide-react"
import { Amount } from "@/components/amount"
import { CategoryBadge } from "@/components/categories/category-badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { FixedItem, FixedItemOverview } from "@/lib/api"
import { dueDescription, FIXED_ITEM_CURRENCY, latestPastOccurrence } from "@/lib/fixed-items"
import { formatDate } from "@/lib/format"
import { Deviation } from "./deviation"
import { DeleteFixedItemButton } from "./delete-fixed-item-button"
import { FixedItemDialog } from "./fixed-item-dialog"
import { OccurrenceStatusBadge } from "./occurrence-status-badge"

type FixedItemsTableProps = {
  items: FixedItem[]
  overviews: Map<string, FixedItemOverview>
  today: string
  onView: (id: string) => void
}

export function FixedItemsTable({ items, overviews, today, onView }: FixedItemsTableProps) {
  if (items.length === 0) {
    return <p className="p-6 text-center text-sm text-muted-foreground">Aucun poste fixe pour l'instant.</p>
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-6">Nom</TableHead>
          <TableHead>Catégorie</TableHead>
          <TableHead>Périodicité</TableHead>
          <TableHead className="text-right">Attendu</TableHead>
          <TableHead className="text-right">Mensualisé</TableHead>
          <TableHead>Prochaine échéance</TableHead>
          <TableHead>Dernière échéance</TableHead>
          <TableHead className="pr-6 text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <FixedItemRow key={item.id} item={item} overview={overviews.get(item.id)} today={today} onView={onView} />
        ))}
      </TableBody>
    </Table>
  )
}

type FixedItemRowProps = {
  item: FixedItem
  overview: FixedItemOverview | undefined
  today: string
  onView: (id: string) => void
}

function FixedItemRow({ item, overview, today, onView }: FixedItemRowProps) {
  const next = overview?.nextOccurrence ?? null
  const latest = overview ? latestPastOccurrence(overview.occurrences, today) : undefined

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
      <TableCell className="text-right">
        <Amount amount={item.monthlyEquivalent} currency={FIXED_ITEM_CURRENCY} className="text-muted-foreground" />
      </TableCell>
      <TableCell>
        {next ? (
          <div className="flex items-center gap-2">
            <span className="tabular-nums">{formatDate(next.dueDate)}</span>
            <OccurrenceStatusBadge status={next.status} />
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        {latest ? (
          <div className="flex items-center gap-2">
            <OccurrenceStatusBadge status={latest.status} />
            <Deviation report={latest} />
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
