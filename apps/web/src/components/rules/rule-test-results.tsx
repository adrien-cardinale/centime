import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useIsMobile } from "@/hooks/use-mobile"
import type { RuleTestResult } from "@/lib/api"
import { formatDate, formatDecimal } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useTranslation } from "react-i18next"

type RuleTestSample = RuleTestResult["samples"][number]

export function RuleTestResults({ result }: { result: RuleTestResult }) {
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  const summary = result.count === 0 ? t("rules.tester.matchNone") : t("rules.tester.match", { count: result.count })
  const hasSamples = result.samples.length > 0
  return (
    <div className="space-y-2 rounded-md border p-3">
      <p className="text-sm font-medium">{summary}</p>
      {hasSamples && isMobile && <SampleList samples={result.samples} />}
      {hasSamples && !isMobile && <SampleTable samples={result.samples} />}
    </div>
  )
}

function sampleLabel(sample: RuleTestSample): string {
  return sample.merchant ?? sample.rawLabel
}

function SampleAmount({ amount }: { amount: number }) {
  return <span className={cn("tabular-nums whitespace-nowrap", amount < 0 && "text-destructive")}>{formatDecimal(amount)}</span>
}

function SampleList({ samples }: { samples: RuleTestSample[] }) {
  return (
    <ul className="divide-y text-sm">
      {samples.map((sample) => (
        <li key={sample.id} className="space-y-0.5 py-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-muted-foreground tabular-nums">{formatDate(sample.bookingDate)}</span>
            <SampleAmount amount={sample.amount} />
          </div>
          <p className="line-clamp-2 break-words">{sampleLabel(sample)}</p>
        </li>
      ))}
    </ul>
  )
}

function SampleTable({ samples }: { samples: RuleTestSample[] }) {
  const { t } = useTranslation()
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("rules.tester.columns.date")}</TableHead>
          <TableHead>{t("rules.tester.columns.label")}</TableHead>
          <TableHead className="text-right">{t("rules.tester.columns.amount")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {samples.map((sample) => (
          <TableRow key={sample.id}>
            <TableCell className="tabular-nums">{formatDate(sample.bookingDate)}</TableCell>
            <TableCell className="max-w-80 truncate" title={sample.rawLabel}>
              {sampleLabel(sample)}
            </TableCell>
            <TableCell className="text-right">
              <SampleAmount amount={sample.amount} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
