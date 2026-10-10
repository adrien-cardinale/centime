import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { CategoryBadge } from "@/components/categories/category-badge"
import { CategoryDialog } from "@/components/categories/category-dialog"
import { useUpdateTransaction } from "@/hooks/use-transaction-updates"
import type { TransactionItem } from "@/lib/api"
import { CategoryCommand } from "./category-command"
import { ResponsiveChooser } from "./responsive-chooser"

const RULE_TOAST_DURATION_MS = 8000

type CategoryCellProps = {
  transaction: TransactionItem
  onCreateRule: (transaction: TransactionItem) => void
}

export function CategoryCell({ transaction, onCreateRule }: CategoryCellProps) {
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
