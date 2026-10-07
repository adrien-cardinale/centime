import { suggestRulePattern } from "@centime/core"
import { useState } from "react"
import { Amount } from "@/components/amount"
import { RuleDialog, type RuleFormValues } from "@/components/rules/rule-dialog"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { TransactionItem } from "@/lib/api"
import { formatDate } from "@/lib/format"
import { transactionStatusLabels } from "@/lib/labels"
import { CategoryCell } from "./category-cell"
import { FixedItemCell } from "./fixed-item-cell"
import { TransactionRowActions } from "./transaction-row-actions"

type TransactionsTableProps = {
  items: TransactionItem[]
  selectedIds: ReadonlySet<string>
  onSelectionChange: (selectedIds: Set<string>) => void
}

function ruleValuesFrom(transaction: TransactionItem): Partial<RuleFormValues> {
  return {
    ...suggestRulePattern(transaction),
    matchKind: "contains",
    categoryId: transaction.categoryId,
    markAsTransfer: transaction.isTransfer,
  }
}

function headerCheckState(items: TransactionItem[], selectedIds: ReadonlySet<string>): boolean | "indeterminate" {
  const selectedCount = items.filter((item) => selectedIds.has(item.id)).length
  if (selectedCount === 0) return false
  return selectedCount === items.length ? true : "indeterminate"
}

export function TransactionsTable({ items, selectedIds, onSelectionChange }: TransactionsTableProps) {
  const [ruleSource, setRuleSource] = useState<TransactionItem | null>(null)
  const [linkingId, setLinkingId] = useState<string | null>(null)

  const toggleAll = (checked: boolean) => onSelectionChange(new Set(checked ? items.map((item) => item.id) : []))
  const toggleOne = (id: string, checked: boolean) => {
    const next = new Set(selectedIds)
    if (checked) next.add(id)
    else next.delete(id)
    onSelectionChange(next)
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10 pl-6">
              <Checkbox
                aria-label="Tout sélectionner"
                checked={headerCheckState(items, selectedIds)}
                onCheckedChange={(checked) => toggleAll(checked === true)}
              />
            </TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Compte</TableHead>
            <TableHead>Libellé</TableHead>
            <TableHead>Commerçant</TableHead>
            <TableHead>Catégorie</TableHead>
            <TableHead className="w-8 px-0">
              <span className="sr-only">Poste fixe</span>
            </TableHead>
            <TableHead className="text-right">Montant</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="w-12 pr-6" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id} data-state={selectedIds.has(item.id) ? "selected" : undefined}>
              <TableCell className="pl-6">
                <Checkbox
                  aria-label="Sélectionner la transaction"
                  checked={selectedIds.has(item.id)}
                  onCheckedChange={(checked) => toggleOne(item.id, checked === true)}
                />
              </TableCell>
              <TableCell className="tabular-nums">{formatDate(item.bookingDate)}</TableCell>
              <TableCell className="max-w-40 truncate" title={item.accountName}>
                {item.accountName}
              </TableCell>
              <TableCell className="max-w-96" title={item.rawLabel}>
                <div className="flex items-center gap-2">
                  <span className="truncate">{item.rawLabel}</span>
                  {item.isTransfer && (
                    <Badge variant="outline" className="text-muted-foreground">
                      Transfert
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>{item.merchant ?? "—"}</TableCell>
              <TableCell>
                <CategoryCell transaction={item} onCreateRule={setRuleSource} />
              </TableCell>
              <TableCell className="px-0">
                <FixedItemCell
                  transaction={item}
                  open={linkingId === item.id}
                  onOpenChange={(open) => setLinkingId(open ? item.id : null)}
                />
              </TableCell>
              <TableCell className="text-right">
                <Amount amount={item.amount} currency={item.currency} />
              </TableCell>
              <TableCell>
                <Badge variant={item.status === "pending" ? "outline" : "secondary"}>
                  {transactionStatusLabels[item.status]}
                </Badge>
              </TableCell>
              <TableCell className="pr-6">
                <TransactionRowActions
                  transaction={item}
                  onCreateRule={setRuleSource}
                  onLinkFixedItem={(transaction) => setLinkingId(transaction.id)}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {ruleSource && (
        <RuleDialog
          applyAfterCreate
          open
          initialValues={ruleValuesFrom(ruleSource)}
          onOpenChange={(open) => !open && setRuleSource(null)}
        />
      )}
    </>
  )
}
