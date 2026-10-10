import { useTranslation } from "react-i18next"
import { Amount } from "@/components/amount"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useIsMobile } from "@/hooks/use-mobile"
import type { PreviewRow } from "@/lib/api"
import { formatDate } from "@/lib/format"
import { RowStateBadge } from "./row-state-badge"

type PreviewTableProps = {
  rows: PreviewRow[]
  total: number
  fallbackAccountName: string | null
}

function rowKey(row: PreviewRow, index: number): string {
  return `${row.bookingDate}-${index}`
}

export function PreviewTable({ rows, total, fallbackAccountName }: PreviewTableProps) {
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  if (rows.length === 0) {
    return <p className="p-6 text-center text-sm text-muted-foreground">{t("importWorkspace.preview.empty")}</p>
  }

  return (
    <div>
      {isMobile ? (
        <PreviewList rows={rows} />
      ) : (
        <PreviewGrid rows={rows} fallbackAccountName={fallbackAccountName} />
      )}
      {total > rows.length && (
        <p className="border-t p-3 text-center text-sm text-muted-foreground">
          {t("importWorkspace.preview.limited", { shown: rows.length, total })}
        </p>
      )}
    </div>
  )
}

function PreviewList({ rows }: { rows: PreviewRow[] }) {
  return (
    <ul className="divide-y border-t">
      {rows.map((row, index) => (
        <li key={rowKey(row, index)} className="space-y-1 px-4 py-3">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="text-muted-foreground tabular-nums">{formatDate(row.bookingDate)}</span>
            <Amount amount={row.amount} currency={row.currency} />
          </div>
          <p className="line-clamp-2 text-sm break-words">{row.rawLabel}</p>
          <RowStateBadge state={row.state} />
        </li>
      ))}
    </ul>
  )
}

type PreviewGridProps = {
  rows: PreviewRow[]
  fallbackAccountName: string | null
}

function PreviewGrid({ rows, fallbackAccountName }: PreviewGridProps) {
  const { t } = useTranslation()
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-6">{t("importWorkspace.preview.date")}</TableHead>
          <TableHead>{t("importWorkspace.preview.label")}</TableHead>
          <TableHead>{t("importWorkspace.preview.merchant")}</TableHead>
          <TableHead className="text-right">{t("importWorkspace.preview.amount")}</TableHead>
          <TableHead>{t("importWorkspace.preview.account")}</TableHead>
          <TableHead className="pr-6">{t("importWorkspace.preview.state")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => (
          <TableRow key={rowKey(row, index)}>
            <TableCell className="pl-6 tabular-nums">{formatDate(row.bookingDate)}</TableCell>
            <TableCell className="max-w-80 truncate" title={row.rawLabel}>
              {row.rawLabel}
            </TableCell>
            <TableCell>{row.merchant ?? "—"}</TableCell>
            <TableCell className="text-right">
              <Amount amount={row.amount} currency={row.currency} />
            </TableCell>
            <TableCell className="font-mono text-xs">{row.accountIdentifier ?? fallbackAccountName ?? "—"}</TableCell>
            <TableCell className="pr-6">
              <RowStateBadge state={row.state} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
