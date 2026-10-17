import { ArrowLeftRight, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { CategorySelect } from "@/components/categories/category-select"
import { Button } from "@/components/ui/button"
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
  const count = selectedIds.length

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/50 px-4 py-3">
      <p className="text-sm font-medium">{t("transactionsPage.bulk.selected", { count })}</p>
      <CategorySelect
        value={undefined}
        onChange={(value) => actions.assignCategory(value === NO_CATEGORY ? null : value)}
        extraOptions={[{ value: NO_CATEGORY, label: t("transactionsPage.none") }]}
        placeholder={t("transactionsPage.bulk.assignCategory")}
        className="w-56 bg-background"
        disabled={actions.pending}
      />
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
