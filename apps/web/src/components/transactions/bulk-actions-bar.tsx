import { ArrowLeftRight, Repeat, X } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { CategorySelect } from "@/components/categories/category-select"
import { FixedItemCommand } from "@/components/fixed-items/fixed-item-command"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useIsMobile } from "@/hooks/use-mobile"
import { MobileBulkActionsBar } from "./mobile-bulk-actions-bar"
import { useBulkActions } from "./use-bulk-actions"

const NO_CATEGORY = "none"

export type BulkActionsBarProps = {
  selectedIds: string[]
  onClear: () => void
}

export function BulkActionsBar(props: BulkActionsBarProps) {
  const isMobile = useIsMobile()
  return isMobile ? <MobileBulkActionsBar {...props} /> : <DesktopBulkActionsBar {...props} />
}

function DesktopBulkActionsBar({ selectedIds, onClear }: BulkActionsBarProps) {
  const { t } = useTranslation()
  const actions = useBulkActions(selectedIds, onClear)
  const [linkOpen, setLinkOpen] = useState(false)
  const count = selectedIds.length

  const linkFixedItem = (fixedItemId: string | null) => {
    setLinkOpen(false)
    actions.linkFixedItem(fixedItemId)
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/50 px-4 py-3">
      <p className="text-sm font-medium">
        {t("transactionsPage.bulk.selected", { count })}
      </p>
      <CategorySelect
        value={undefined}
        onChange={(value) => actions.assignCategory(value === NO_CATEGORY ? null : value)}
        extraOptions={[{ value: NO_CATEGORY, label: t("transactionsPage.none") }]}
        placeholder={t("transactionsPage.bulk.assignCategory")}
        className="w-56 bg-background"
        disabled={actions.pending}
      />
      <Popover open={linkOpen} onOpenChange={setLinkOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" disabled={actions.pending}>
            <Repeat />
            {t("transactionsPage.linkFixedItem")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <FixedItemCommand onSelect={linkFixedItem} />
        </PopoverContent>
      </Popover>
      <Button variant="outline" size="sm" onClick={() => actions.setTransfer(true)} disabled={actions.pending}>
        <ArrowLeftRight />
        {t("transactionsPage.markTransfer")}
      </Button>
      <Button variant="outline" size="sm" onClick={() => actions.setTransfer(false)} disabled={actions.pending}>
        {t("transactionsPage.removeTransfer")}
      </Button>
      <Button variant="ghost" size="sm" onClick={onClear} className="ml-auto">
        <X />
        {t("transactionsPage.bulk.clear")}
      </Button>
    </div>
  )
}
