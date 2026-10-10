import { useBulkUpdateTransactions } from "@/hooks/use-transaction-updates"

export function useBulkActions(selectedIds: string[], onClear: () => void) {
  const bulkUpdate = useBulkUpdateTransactions(onClear)
  return {
    pending: bulkUpdate.isPending,
    assignCategory: (categoryId: string | null) => bulkUpdate.mutate({ ids: selectedIds, changes: { categoryId } }),
    setTransfer: (isTransfer: boolean) => bulkUpdate.mutate({ ids: selectedIds, changes: { isTransfer } }),
    linkFixedItem: (fixedItemId: string | null) => bulkUpdate.mutate({ ids: selectedIds, changes: { fixedItemId } }),
  }
}
