import { useAutoRules } from "@/hooks/use-auto-rules"
import { useBulkUpdateTransactions } from "@/hooks/use-transaction-updates"

export function useBulkActions(selectedIds: string[], onClear: () => void) {
  const bulkUpdate = useBulkUpdateTransactions(onClear)
  const createAutoRules = useAutoRules()

  const assignCategory = async (categoryId: string | null) => {
    const ids = selectedIds
    const succeeded = await bulkUpdate.mutateAsync({ ids, changes: { categoryId } }).then(
      () => true,
      () => false,
    )
    if (succeeded && categoryId !== null) await createAutoRules(ids)
  }

  return {
    pending: bulkUpdate.isPending,
    assignCategory,
    setTransfer: (isTransfer: boolean) => bulkUpdate.mutate({ ids: selectedIds, changes: { isTransfer } }),
  }
}
