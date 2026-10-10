import { ArrowLeftRight, Repeat, Tags, X } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { FixedItemCommand } from "@/components/fixed-items/fixed-item-command"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { BulkActionsBarProps } from "./bulk-actions-bar"
import { CategoryCommand } from "./category-command"
import { ResponsiveChooser } from "./responsive-chooser"
import { useBulkActions } from "./use-bulk-actions"

type Chooser = "category" | "fixedItem" | null

export function MobileBulkActionsBar({ selectedIds, onClear }: BulkActionsBarProps) {
  const { t } = useTranslation()
  const actions = useBulkActions(selectedIds, onClear)
  const [chooser, setChooser] = useState<Chooser>(null)
  const openChange = (target: Exclude<Chooser, null>) => (open: boolean) => setChooser(open ? target : null)

  const assignCategory = (categoryId: string | null) => {
    setChooser(null)
    actions.assignCategory(categoryId)
  }
  const linkFixedItem = (fixedItemId: string | null) => {
    setChooser(null)
    actions.linkFixedItem(fixedItemId)
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 flex items-center gap-1 border-t bg-background px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
      <p className="min-w-0 flex-1 truncate pl-2 text-sm font-medium">
        {t("transactionsPage.bulk.selected", { count: selectedIds.length })}
      </p>
      <ResponsiveChooser
        open={chooser === "category"}
        onOpenChange={openChange("category")}
        title={t("transactionsPage.bulk.assignCategory")}
        trigger={
          <Button variant="ghost" size="icon" aria-label={t("transactionsPage.bulk.assignCategory")} disabled={actions.pending}>
            <Tags />
          </Button>
        }
      >
        <CategoryCommand onSelect={assignCategory} />
      </ResponsiveChooser>
      <ResponsiveChooser
        open={chooser === "fixedItem"}
        onOpenChange={openChange("fixedItem")}
        title={t("transactionsPage.linkFixedItem")}
        trigger={
          <Button variant="ghost" size="icon" aria-label={t("transactionsPage.linkFixedItem")} disabled={actions.pending}>
            <Repeat />
          </Button>
        }
      >
        <FixedItemCommand onSelect={linkFixedItem} />
      </ResponsiveChooser>
      <TransferMenu disabled={actions.pending} onSetTransfer={actions.setTransfer} />
      <Button variant="ghost" size="icon" aria-label={t("transactionsPage.bulk.clear")} onClick={onClear}>
        <X />
      </Button>
    </div>
  )
}

function TransferMenu({ disabled, onSetTransfer }: { disabled: boolean; onSetTransfer: (isTransfer: boolean) => void }) {
  const { t } = useTranslation()
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("transactionsPage.bulk.transferActions")} disabled={disabled}>
          <ArrowLeftRight />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top">
        <DropdownMenuItem onSelect={() => onSetTransfer(true)}>{t("transactionsPage.markTransfer")}</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onSetTransfer(false)}>{t("transactionsPage.removeTransfer")}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
