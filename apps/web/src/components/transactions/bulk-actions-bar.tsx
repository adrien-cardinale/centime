import { ArrowLeftRight, Repeat, X } from "lucide-react"
import { useState } from "react"
import { CategorySelect } from "@/components/categories/category-select"
import { FixedItemCommand } from "@/components/fixed-items/fixed-item-command"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useBulkUpdateTransactions } from "@/hooks/use-transaction-updates"

const NO_CATEGORY = "none"

type BulkActionsBarProps = {
  selectedIds: string[]
  onClear: () => void
}

export function BulkActionsBar({ selectedIds, onClear }: BulkActionsBarProps) {
  const bulkUpdate = useBulkUpdateTransactions(onClear)
  const [linkOpen, setLinkOpen] = useState(false)
  const count = selectedIds.length

  const assignCategory = (value: string) =>
    bulkUpdate.mutate({ ids: selectedIds, changes: { categoryId: value === NO_CATEGORY ? null : value } })
  const setTransfer = (isTransfer: boolean) => bulkUpdate.mutate({ ids: selectedIds, changes: { isTransfer } })
  const linkFixedItem = (fixedItemId: string | null) => {
    setLinkOpen(false)
    bulkUpdate.mutate({ ids: selectedIds, changes: { fixedItemId } })
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/50 px-4 py-3">
      <p className="text-sm font-medium">
        {count} sélectionnée{count > 1 ? "s" : ""}
      </p>
      <CategorySelect
        value={undefined}
        onChange={assignCategory}
        extraOptions={[{ value: NO_CATEGORY, label: "Aucune" }]}
        placeholder="Attribuer une catégorie"
        className="w-56 bg-background"
        disabled={bulkUpdate.isPending}
      />
      <Popover open={linkOpen} onOpenChange={setLinkOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" disabled={bulkUpdate.isPending}>
            <Repeat />
            Lier à un poste fixe
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <FixedItemCommand onSelect={linkFixedItem} />
        </PopoverContent>
      </Popover>
      <Button variant="outline" size="sm" onClick={() => setTransfer(true)} disabled={bulkUpdate.isPending}>
        <ArrowLeftRight />
        Marquer comme transfert
      </Button>
      <Button variant="outline" size="sm" onClick={() => setTransfer(false)} disabled={bulkUpdate.isPending}>
        Retirer le transfert
      </Button>
      <Button variant="ghost" size="sm" onClick={onClear} className="ml-auto">
        <X />
        Annuler la sélection
      </Button>
    </div>
  )
}
