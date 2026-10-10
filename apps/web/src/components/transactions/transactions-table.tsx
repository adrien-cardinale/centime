import { suggestRulePattern } from "@centime/core"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Amount } from "@/components/amount"
import { ReceiptBadgeButton } from "@/components/receipts/receipt-badge-button"
import { ReceiptDialog } from "@/components/receipts/receipt-dialog"
import { ReceiptSheet } from "@/components/receipts/receipt-sheet"
import { useLinkedReceipts } from "@/components/receipts/use-linked-receipts"
import { RuleDialog, type RuleFormValues } from "@/components/rules/rule-dialog"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useIsMobile } from "@/hooks/use-mobile"
import type { Receipt, TransactionItem } from "@/lib/api"
import { formatDate } from "@/lib/format"
import { transactionStatusLabels } from "@/lib/labels"
import { CategoryCell } from "./category-cell"
import { FixedItemCell } from "./fixed-item-cell"
import { SplitTransactionDialog } from "./split-transaction-dialog"
import { TransactionList } from "./transaction-list"
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
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  const [ruleSource, setRuleSource] = useState<TransactionItem | null>(null)
  const [linkingId, setLinkingId] = useState<string | null>(null)
  const [splitting, setSplitting] = useState<TransactionItem | null>(null)
  const [attaching, setAttaching] = useState<TransactionItem | null>(null)
  const [openedReceiptId, setOpenedReceiptId] = useState<string | null>(null)
  const receiptsByTransaction = useLinkedReceipts()
  const openReceipt = (receipt: Receipt) => setOpenedReceiptId(receipt.id)
  const overlays = (
    <RowOverlays
      ruleSource={ruleSource}
      onRuleClose={() => setRuleSource(null)}
      splitting={splitting}
      onSplitClose={() => setSplitting(null)}
      attaching={attaching}
      onAttachClose={() => setAttaching(null)}
      openedReceiptId={openedReceiptId}
      onReceiptClose={() => setOpenedReceiptId(null)}
    />
  )

  const toggleAll = (checked: boolean) => onSelectionChange(new Set(checked ? items.map((item) => item.id) : []))
  const toggleOne = (id: string, checked: boolean) => {
    const next = new Set(selectedIds)
    if (checked) next.add(id)
    else next.delete(id)
    onSelectionChange(next)
  }

  if (isMobile) {
    return (
      <>
        <TransactionList
          items={items}
          selectedIds={selectedIds}
          onToggleOne={toggleOne}
          onToggleAll={toggleAll}
          onCreateRule={setRuleSource}
          onSplit={setSplitting}
          onAttachReceipt={setAttaching}
          receiptsByTransaction={receiptsByTransaction}
          onOpenReceipt={openReceipt}
          linkingId={linkingId}
          onLinkingChange={setLinkingId}
        />
        {overlays}
      </>
    )
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10 pl-4 sm:pl-6">
              <Checkbox
                aria-label={t("transactionsPage.table.selectAll")}
                checked={headerCheckState(items, selectedIds)}
                onCheckedChange={(checked) => toggleAll(checked === true)}
              />
            </TableHead>
            <TableHead>{t("transactionsPage.columns.date")}</TableHead>
            <TableHead className="hidden md:table-cell">{t("transactionsPage.columns.account")}</TableHead>
            <TableHead>{t("transactionsPage.columns.label")}</TableHead>
            <TableHead className="hidden lg:table-cell">{t("transactionsPage.columns.merchant")}</TableHead>
            <TableHead>{t("transactionsPage.columns.category")}</TableHead>
            <TableHead className="w-8 px-0">
              <span className="sr-only">{t("transactionsPage.columns.fixedItem")}</span>
            </TableHead>
            <TableHead className="text-right">{t("transactionsPage.columns.amount")}</TableHead>
            <TableHead className="hidden md:table-cell">{t("transactionsPage.columns.status")}</TableHead>
            <TableHead className="w-12 pr-4 sm:pr-6" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id} data-state={selectedIds.has(item.id) ? "selected" : undefined}>
              <TableCell className="pl-4 sm:pl-6">
                <Checkbox
                  aria-label={t("transactionsPage.table.selectOne")}
                  checked={selectedIds.has(item.id)}
                  onCheckedChange={(checked) => toggleOne(item.id, checked === true)}
                />
              </TableCell>
              <TableCell className="tabular-nums">{formatDate(item.bookingDate)}</TableCell>
              <TableCell className="hidden max-w-40 truncate md:table-cell" title={item.accountName}>
                {item.accountName}
              </TableCell>
              <TableCell className="max-w-96" title={item.rawLabel}>
                <div className="flex items-center gap-2">
                  <span className="truncate">{item.rawLabel}</span>
                  <ReceiptBadgeButton receipt={receiptsByTransaction.get(item.id)} onOpen={openReceipt} />
                  {item.status === "pending" && (
                    <Badge variant="outline" className="md:hidden">
                      {transactionStatusLabels[item.status]}
                    </Badge>
                  )}
                  {item.isTransfer && (
                    <Badge variant="outline" className="text-muted-foreground">
                      {t("transactionsPage.table.transfer")}
                    </Badge>
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground md:hidden">{item.accountName}</p>
              </TableCell>
              <TableCell className="hidden lg:table-cell">{item.merchant ?? "—"}</TableCell>
              <TableCell>
                <CategoryCell transaction={item} onCreateRule={setRuleSource} onSplit={setSplitting} />
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
              <TableCell className="hidden md:table-cell">
                <Badge variant={item.status === "pending" ? "outline" : "secondary"}>
                  {transactionStatusLabels[item.status]}
                </Badge>
              </TableCell>
              <TableCell className="pr-4 sm:pr-6">
                <TransactionRowActions
                  transaction={item}
                  onCreateRule={setRuleSource}
                  onLinkFixedItem={(transaction) => setLinkingId(transaction.id)}
                  onSplit={setSplitting}
                  onAttachReceipt={setAttaching}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {overlays}
    </>
  )
}

type RowOverlaysProps = {
  ruleSource: TransactionItem | null
  onRuleClose: () => void
  splitting: TransactionItem | null
  onSplitClose: () => void
  attaching: TransactionItem | null
  onAttachClose: () => void
  openedReceiptId: string | null
  onReceiptClose: () => void
}

function RowOverlays({
  ruleSource,
  onRuleClose,
  splitting,
  onSplitClose,
  attaching,
  onAttachClose,
  openedReceiptId,
  onReceiptClose,
}: RowOverlaysProps) {
  return (
    <>
      {ruleSource && (
        <RuleDialog
          applyAfterCreate
          open
          initialValues={ruleValuesFrom(ruleSource)}
          onOpenChange={(open) => !open && onRuleClose()}
        />
      )}
      {splitting && <SplitTransactionDialog key={splitting.id} transaction={splitting} onClose={onSplitClose} />}
      {attaching && (
        <ReceiptDialog
          key={attaching.id}
          open
          transaction={attaching}
          onOpenChange={(open) => !open && onAttachClose()}
        />
      )}
      <ReceiptSheet receiptId={openedReceiptId} onOpenChange={(open) => !open && onReceiptClose()} />
    </>
  )
}
