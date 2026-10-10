import type { PeriodRange } from "@centime/core"
import { Pencil } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Amount } from "@/components/amount"
import { CategoryBadge } from "@/components/categories/category-badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useIsMobile } from "@/hooks/use-mobile"
import type { FixedItem, FixedItemOverview } from "@/lib/api"
import { dueDescription, FIXED_ITEM_CURRENCY } from "@/lib/fixed-items"
import { Deviation } from "./deviation"
import { DeleteFixedItemButton } from "./delete-fixed-item-button"
import { FixedItemCards } from "./fixed-item-cards"
import { FixedItemDialog } from "./fixed-item-dialog"
import { MonthDue } from "./month-due"
import { type MonthRow, monthRows } from "./month-rows"

type FixedItemsTableProps = {
  items: FixedItem[]
  overviews: Map<string, FixedItemOverview>
  month: PeriodRange
  emptyMessage: string
  onView: (id: string) => void
}

export function FixedItemsTable({ items, overviews, month, emptyMessage, onView }: FixedItemsTableProps) {
  const isMobile = useIsMobile()
  if (items.length === 0) {
    return <p className="p-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>
  }
  const rows = monthRows(items, overviews, month)
  if (isMobile) return <FixedItemCards rows={rows} onView={onView} />
  return <DesktopTable rows={rows} onView={onView} />
}

type RowsProps = {
  rows: MonthRow[]
  onView: (id: string) => void
}

function DesktopTable({ rows, onView }: RowsProps) {
  const { t } = useTranslation()
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-6">{t("fixedItemsUi.table.name")}</TableHead>
          <TableHead>{t("fixedItemsUi.table.category")}</TableHead>
          <TableHead>{t("fixedItemsUi.table.periodicity")}</TableHead>
          <TableHead className="text-right">{t("fixedItemsUi.table.expected")}</TableHead>
          <TableHead>{t("fixedItemsUi.table.monthDue")}</TableHead>
          <TableHead className="text-right">{t("fixedItemsUi.table.actual")}</TableHead>
          <TableHead className="pr-6 text-right">{t("fixedItemsUi.table.actions")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <FixedItemRow key={row.item.id} row={row} onView={onView} />
        ))}
      </TableBody>
    </Table>
  )
}

function isActivationKey(key: string): boolean {
  return key === "Enter" || key === " "
}

type FixedItemRowProps = {
  row: MonthRow
  onView: (id: string) => void
}

function FixedItemRow({ row, onView }: FixedItemRowProps) {
  const { t } = useTranslation()
  const { item, occurrence } = row
  return (
    <TableRow
      tabIndex={0}
      className="cursor-pointer focus-visible:bg-muted/50 focus-visible:outline-none"
      onClick={() => onView(item.id)}
      onKeyDown={(event) => event.target === event.currentTarget && isActivationKey(event.key) && onView(item.id)}
    >
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
        <MonthDue row={row} />
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
          <FixedItemDialog
            item={item}
            trigger={
              <Button variant="ghost" size="icon" aria-label={t("fixedItemsUi.table.edit", { name: item.name })}>
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
