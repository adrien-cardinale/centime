import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { RuleTestResult } from "@/lib/api"
import { formatDate, formatDecimal } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useTranslation } from "react-i18next"

export function RuleTestResults({ result }: { result: RuleTestResult }) {
  const { t } = useTranslation()
  const summary = result.count === 0 ? t("rules.tester.matchNone") : t("rules.tester.match", { count: result.count })
  return (
    <div className="space-y-2 rounded-md border p-3">
      <p className="text-sm font-medium">{summary}</p>
      {result.samples.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("rules.tester.columns.date")}</TableHead>
              <TableHead>{t("rules.tester.columns.label")}</TableHead>
              <TableHead className="text-right">{t("rules.tester.columns.amount")}</TableHead>
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
