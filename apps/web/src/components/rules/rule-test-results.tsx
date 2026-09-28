import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { RuleTestResult } from "@/lib/api"
import { formatDate, formatDecimal } from "@/lib/format"
import { cn } from "@/lib/utils"

function matchSummary(count: number): string {
  if (count === 0) return "Aucune transaction ne correspond."
  return `${count} transaction${count > 1 ? "s correspondent" : " correspond"}.`
}

export function RuleTestResults({ result }: { result: RuleTestResult }) {
  return (
    <div className="space-y-2 rounded-md border p-3">
      <p className="text-sm font-medium">{matchSummary(result.count)}</p>
      {result.samples.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Libellé</TableHead>
              <TableHead className="text-right">Montant</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.samples.map((sample) => (
              <TableRow key={sample.id}>
                <TableCell className="tabular-nums">{formatDate(sample.bookingDate)}</TableCell>
                <TableCell className="max-w-80 truncate" title={sample.rawLabel}>
                  {sample.merchant ?? sample.rawLabel}
                </TableCell>
                <TableCell className={cn("text-right tabular-nums", sample.amount < 0 && "text-destructive")}>
                  {formatDecimal(sample.amount)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
