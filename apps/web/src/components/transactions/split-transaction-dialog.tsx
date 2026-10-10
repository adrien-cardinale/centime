import { MAX_SPLIT_NOTE_LENGTH, MAX_SPLITS, MIN_SPLITS, splitRemainder } from "@centime/core"
import { Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Amount } from "@/components/amount"
import { CategorySelect } from "@/components/categories/category-select"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useSplitTransaction, useUnsplitTransaction } from "@/hooks/use-transaction-updates"
import type { TransactionItem } from "@/lib/api"
import { formatAmount, formatDate, parseAmountInput } from "@/lib/format"
import { cn } from "@/lib/utils"

const NO_CATEGORY = "none"

type SplitLine = { key: string; categoryId: string | null; amountText: string; note: string }

type SplitTransactionDialogProps = {
  transaction: TransactionItem
  onClose: () => void
}

function emptyLine(categoryId: string | null = null): SplitLine {
  return { key: crypto.randomUUID(), categoryId, amountText: "", note: "" }
}

function amountText(amount: number): string {
  return Math.abs(amount).toFixed(2)
}

function initialLines(transaction: TransactionItem): SplitLine[] {
  if (transaction.isSplit && transaction.splits.length >= MIN_SPLITS) {
    return transaction.splits.map((split) => ({
      key: split.id,
      categoryId: split.categoryId,
      amountText: amountText(split.amount),
      note: split.note ?? "",
    }))
  }
  return [emptyLine(transaction.categoryId), emptyLine()]
}

function signedAmount(text: string, total: number): number | null {
  const amount = parseAmountInput(text)
  if (amount === null || amount === 0) return null
  return total < 0 ? -Math.abs(amount) : Math.abs(amount)
}

function remainderOf(lines: SplitLine[], total: number): number {
  return splitRemainder(
    total,
    lines.map((line) => ({ amount: signedAmount(line.amountText, total) ?? 0 })),
  )
}

export function SplitTransactionDialog({ transaction, onClose }: SplitTransactionDialogProps) {
  const { t } = useTranslation()
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("transactionsPage.split.title")}</DialogTitle>
          <DialogDescription>{t("transactionsPage.split.description")}</DialogDescription>
        </DialogHeader>
        <TransactionSummary transaction={transaction} />
        <SplitForm transaction={transaction} onDone={onClose} />
      </DialogContent>
    </Dialog>
  )
}

function TransactionSummary({ transaction }: { transaction: TransactionItem }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border bg-muted/40 px-3 py-2 text-sm">
      <div className="min-w-0">
        <p className="truncate font-medium" title={transaction.rawLabel}>
          {transaction.rawLabel}
        </p>
        <p className="text-muted-foreground tabular-nums">{formatDate(transaction.bookingDate)}</p>
      </div>
      <Amount amount={transaction.amount} currency={transaction.currency} className="font-medium" />
    </div>
  )
}

function SplitForm({ transaction, onDone }: { transaction: TransactionItem; onDone: () => void }) {
  const { t } = useTranslation()
  const [lines, setLines] = useState(() => initialLines(transaction))
  const split = useSplitTransaction(onDone)
  const unsplit = useUnsplitTransaction(onDone)
  const remainder = remainderOf(lines, transaction.amount)
  const everyAmountValid = lines.every((line) => signedAmount(line.amountText, transaction.amount) !== null)
  const canSave = everyAmountValid && remainder === 0 && lines.length >= MIN_SPLITS
  const isPending = split.isPending || unsplit.isPending

  const updateLine = (key: string, changes: Partial<SplitLine>) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...changes } : line)))
  const removeLine = (key: string) => setLines((current) => current.filter((line) => line.key !== key))
  const addLine = () => setLines((current) => [...current, emptyLine()])

  const save = () =>
    split.mutate({
      transactionId: transaction.id,
      splits: lines.map((line) => ({
        categoryId: line.categoryId,
        amount: signedAmount(line.amountText, transaction.amount) ?? 0,
        note: line.note,
      })),
    })

  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {lines.map((line, index) => (
          <SplitLineFields
            key={line.key}
            line={line}
            index={index}
            canRemove={lines.length > MIN_SPLITS}
            onChange={(changes) => updateLine(line.key, changes)}
            onRemove={() => removeLine(line.key)}
          />
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="outline" size="sm" onClick={addLine} disabled={lines.length >= MAX_SPLITS}>
          <Plus />
          {t("transactionsPage.split.addLine")}
        </Button>
        <RemainderInfo
          remainder={remainder}
          total={transaction.amount}
          currency={transaction.currency}
          onFill={() => fillLastLine(lines, remainder, transaction.amount, updateLine)}
        />
      </div>
      <DialogFooter className="sm:justify-between">
        {transaction.isSplit ? (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive"
            disabled={isPending}
            onClick={() => unsplit.mutate(transaction.id)}
          >
            {t("transactionsPage.split.unsplit")}
          </Button>
        ) : (
          <span />
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={onDone}>
            {t("common.cancel")}
          </Button>
          <Button type="button" onClick={save} disabled={!canSave || isPending}>
            {split.isPending ? t("transactionsPage.split.saving") : t("transactionsPage.split.save")}
          </Button>
        </div>
      </DialogFooter>
    </div>
  )
}

function fillLastLine(
  lines: SplitLine[],
  remainder: number,
  total: number,
  updateLine: (key: string, changes: Partial<SplitLine>) => void,
) {
  const last = lines.at(-1)
  if (!last) return
  const filled = (signedAmount(last.amountText, total) ?? 0) + remainder
  if (filled * total <= 0) return
  updateLine(last.key, { amountText: amountText(filled) })
}

type SplitLineFieldsProps = {
  line: SplitLine
  index: number
  canRemove: boolean
  onChange: (changes: Partial<SplitLine>) => void
  onRemove: () => void
}

function SplitLineFields({ line, index, canRemove, onChange, onRemove }: SplitLineFieldsProps) {
  const { t } = useTranslation()
  const idPrefix = `split-${line.key}`
  return (
    <li className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_8rem_auto] sm:items-end">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-category`}>{t("transactionsPage.split.category", { index: index + 1 })}</Label>
        <CategorySelect
          id={`${idPrefix}-category`}
          value={line.categoryId ?? NO_CATEGORY}
          onChange={(categoryId) => onChange({ categoryId: categoryId === NO_CATEGORY ? null : categoryId })}
          extraOptions={[{ value: NO_CATEGORY, label: t("transactionsPage.none") }]}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-amount`}>{t("transactionsPage.split.amount")}</Label>
        <Input
          id={`${idPrefix}-amount`}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder={t("transactionsPage.create.amountPlaceholder")}
          value={line.amountText}
          onChange={(event) => onChange({ amountText: event.target.value })}
        />
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="justify-self-end"
        aria-label={t("transactionsPage.split.removeLine")}
        disabled={!canRemove}
        onClick={onRemove}
      >
        <Trash2 />
      </Button>
      <div className="space-y-1.5 sm:col-span-3">
        <Label htmlFor={`${idPrefix}-note`} className="sr-only">
          {t("transactionsPage.split.note")}
        </Label>
        <Input
          id={`${idPrefix}-note`}
          maxLength={MAX_SPLIT_NOTE_LENGTH}
          placeholder={t("transactionsPage.split.notePlaceholder")}
          value={line.note}
          onChange={(event) => onChange({ note: event.target.value })}
        />
      </div>
    </li>
  )
}

type RemainderInfoProps = { remainder: number; total: number; currency: string; onFill: () => void }

function RemainderInfo({ remainder, total, currency, onFill }: RemainderInfoProps) {
  const { t } = useTranslation()
  const balanced = remainder === 0
  const exceeded = remainder * total < 0
  const amount = formatAmount(Math.abs(remainder), currency)
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={cn("tabular-nums", balanced ? "text-muted-foreground" : "font-medium text-destructive")}>
        {exceeded ? t("transactionsPage.split.exceeded", { amount }) : t("transactionsPage.split.remaining", { amount })}
      </span>
      {!balanced && (
        <Button type="button" variant="link" size="sm" className="h-auto px-0" onClick={onFill}>
          {t("transactionsPage.split.fillLast")}
        </Button>
      )}
    </div>
  )
}
