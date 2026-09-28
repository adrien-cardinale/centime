import { Link } from "@tanstack/react-router"
import { ChevronRight } from "lucide-react"
import { Amount } from "@/components/amount"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Progress } from "@/components/ui/progress"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import type { FixedItem, FixedItemOverview, OccurrenceReport } from "@/lib/api"
import { dueDescription, FIXED_ITEM_CURRENCY } from "@/lib/fixed-items"
import { formatDate } from "@/lib/format"
import { ruleFieldLabels, ruleMatchKindLabels } from "@/lib/labels"
import { Deviation } from "./deviation"
import { OccurrenceStatusBadge } from "./occurrence-status-badge"

type FixedItemSheetProps = {
  item: FixedItem | undefined
  overview: FixedItemOverview | undefined
  onOpenChange: (open: boolean) => void
}

export function FixedItemSheet({ item, overview, onOpenChange }: FixedItemSheetProps) {
  return (
    <Sheet open={item !== undefined} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {item && <FixedItemDetails item={item} overview={overview} />}
      </SheetContent>
    </Sheet>
  )
}

function FixedItemDetails({ item, overview }: { item: FixedItem; overview: FixedItemOverview | undefined }) {
  const occurrences = [...(overview?.occurrences ?? [])].reverse()
  return (
    <>
      <SheetHeader>
        <SheetTitle>{item.name}</SheetTitle>
        <SheetDescription className="flex flex-wrap items-center gap-x-2">
          <Amount amount={item.expectedAmount} currency={FIXED_ITEM_CURRENCY} />
          <span>{dueDescription(item)}</span>
        </SheetDescription>
      </SheetHeader>
      <div className="space-y-6 px-4 pb-6">
        <RuleSummary rule={item.rule} />
        {overview && <PaymentProgress summary={overview.summary} />}
        <section className="space-y-2">
          <h3 className="text-sm font-medium">Échéances de la période</h3>
          {occurrences.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune échéance sur la période.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {occurrences.map((report) => (
                <OccurrenceItem key={report.dueDate} report={report} />
              ))}
            </ul>
          )}
        </section>
        <Link
          to="/transactions"
          search={{ fixedItemId: item.id }}
          className="inline-block text-sm font-medium underline-offset-4 hover:underline"
        >
          Voir toutes les transactions liées ({item.linkedCount})
        </Link>
      </div>
    </>
  )
}

function RuleSummary({ rule }: { rule: FixedItem["rule"] }) {
  if (!rule) return <p className="text-sm text-muted-foreground">Aucune règle de rapprochement.</p>
  return (
    <p className="text-sm">
      <span className="text-muted-foreground">Règle : {ruleFieldLabels[rule.field]} {ruleMatchKindLabels[rule.matchKind]} </span>
      <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{rule.pattern}</code>
    </p>
  )
}

function PaymentProgress({ summary }: { summary: FixedItemOverview["summary"] }) {
  const settled = summary.paidCount + summary.missedCount
  if (settled === 0) return null
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Échéances honorées</span>
        <span className="tabular-nums">
          {summary.paidCount} / {settled}
        </span>
      </div>
      <Progress value={(summary.paidCount / settled) * 100} />
    </div>
  )
}

function OccurrenceItem({ report }: { report: OccurrenceReport }) {
  return (
    <li>
      <Collapsible>
        <CollapsibleTrigger className="group flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted/50">
          <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
          <span className="w-24 tabular-nums">{formatDate(report.dueDate)}</span>
          <OccurrenceStatusBadge status={report.status} />
          <span className="ml-auto flex items-center gap-3">
            {report.actualAmount === null ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              <Amount amount={report.actualAmount} currency={FIXED_ITEM_CURRENCY} />
            )}
            <Deviation report={report} className="w-20 text-right" />
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent className="px-3 pb-3 pl-10">
          <MatchedTransactions report={report} />
        </CollapsibleContent>
      </Collapsible>
    </li>
  )
}

function MatchedTransactions({ report }: { report: OccurrenceReport }) {
  if (report.transactions.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Aucune transaction rattachée entre le {formatDate(report.windowStart)} et le {formatDate(report.windowEnd)}.
      </p>
    )
  }
  return (
    <ul className="space-y-1 text-xs">
      {report.transactions.map((transaction) => (
        <li key={transaction.id} className="flex items-center gap-3">
          <span className="tabular-nums text-muted-foreground">{formatDate(transaction.bookingDate)}</span>
          <span className="truncate" title={transaction.rawLabel}>
            {transaction.rawLabel}
          </span>
          <Amount amount={transaction.amount} currency={FIXED_ITEM_CURRENCY} className="ml-auto" />
        </li>
      ))}
    </ul>
  )
}
