import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import i18n from "@/i18n"
import { api, type TransactionChanges } from "@/lib/api"
import { invalidateTransactionData } from "@/lib/queries"

type SingleUpdate = { id: string; changes: TransactionChanges }
type BulkUpdate = { ids: string[]; changes: TransactionChanges }

export function useUpdateTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, changes }: SingleUpdate) => api.transactions.update(id, changes),
    onSuccess: () => invalidateTransactionData(queryClient),
    onError: (error) => toast.error(error.message),
  })
}

export function useBulkUpdateTransactions(onDone?: () => void) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ ids, changes }: BulkUpdate) => api.transactions.bulkUpdate(ids, changes),
    onSuccess: async ({ updated }) => {
      await invalidateTransactionData(queryClient)
      toast.success(i18n.t("transactionsPage.bulk.updated", { count: updated }))
      onDone?.()
    },
    onError: (error) => toast.error(error.message),
  })
}
