import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Amount } from "@/components/amount"
import { CategoryBadge } from "@/components/categories/category-badge"
import { ColorDot } from "@/components/categories/color-dot"
import { Badge } from "@/components/ui/badge"
import { CategoryDialog } from "@/components/categories/category-dialog"
import { useUpdateTransaction } from "@/hooks/use-transaction-updates"
import type { TransactionItem } from "@/lib/api"
import { CategoryCommand } from "./category-command"
import { ResponsiveChooser } from "./responsive-chooser"

const RULE_TOAST_DURATION_MS = 8000

type CategoryCellProps = {
  transaction: TransactionItem
  onCreateRule: (transaction: TransactionItem) => void
  onSplit: (transaction: TransactionItem) => void
}

export function CategoryCell({ transaction, onCreateRule, onSplit }: CategoryCellProps) {
  if (transaction.isSplit) return <SplitSummary transaction={transaction} onOpen={() => onSplit(transaction)} />
  return <CategoryChooser transaction={transaction} onCreateRule={onCreateRule} />
}

type CategoryChooserProps = Omit<CategoryCellProps, "onSplit">

function CategoryChooser({ transaction, onCreateRule }: CategoryChooserProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [newName, setNewName] = useState<string | null>(null)
  const update = useUpdateTransaction()

  const offerRule = (categoryId: string) =>
    toast(t("transactionsPage.category.changed"), {
      duration: RULE_TOAST_DURATION_MS,
      action: {
        label: t("transactionsPage.category.alwaysClassify"),
        onClick: () => onCreateRule({ ...transaction, categoryId }),
      },
    })

  const choose = (categoryId: string | null) => {
    setOpen(false)
    if (categoryId === transaction.categoryId) return
    update.mutate(
      { id: transaction.id, changes: { categoryId } },
      { onSuccess: () => categoryId && offerRule(categoryId) },
    )
  }

  const startCreating = (name: string) => {
    setOpen(false)
    setNewName(name)
  }

  return (
    <>
      <ResponsiveChooser
        open={open}
        onOpenChange={setOpen}
        title={t("transactionsPage.category.change")}
        trigger={
          <button
            type="button"
            disabled={update.isPending}
            aria-label={t("transactionsPage.category.change")}
            className="-m-1 inline-flex items-center rounded-full p-1 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50 pointer-coarse:min-h-11 pointer-coarse:px-2"
          >
            <CurrentCategory transaction={transaction} />
          </button>
        }
      >
        <CategoryCommand selectedId={transaction.categoryId} onSelect={choose} onCreate={startCreating} />
      </ResponsiveChooser>
      {newName !== null && (
        <CategoryDialog
          open
          onOpenChange={(open) => !open && setNewName(null)}
          initialName={newName}
          onSaved={choose}
        />
      )}
    </>
  )
}

function CurrentCategory({ transaction }: { transaction: TransactionItem }) {
  if (transaction.categoryName && transaction.categoryColor) {
    return <CategoryBadge name={transaction.categoryName} color={transaction.categoryColor} className="cursor-pointer" />
  }
  return <span className="cursor-pointer px-2 text-muted-foreground hover:text-foreground">—</span>
}

function SplitSummary({ transaction, onOpen }: { transaction: TransactionItem; onOpen: () => void }) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      aria-label={t("transactionsPage.split.edit")}
      onClick={onOpen}
      className="-m-1 flex cursor-pointer flex-col items-start gap-1 rounded-md p-1 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <Badge variant="outline">{t("transactionsPage.split.badge")}</Badge>
      <ul className="space-y-0.5 text-xs">
        {transaction.splits.map((split) => (
          <li key={split.id} className="flex items-center gap-1.5">
            {split.categoryColor && <ColorDot color={split.categoryColor} className="size-2" />}
            <span className="max-w-32 truncate">{split.categoryName ?? t("transactionsPage.split.uncategorized")}</span>
            <Amount amount={split.amount} currency={transaction.currency} className="text-muted-foreground" />
          </li>
        ))}
      </ul>
    </button>
  )
}
