import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
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
      toast.success(`${updated} transaction${updated > 1 ? "s" : ""} mise${updated > 1 ? "s" : ""} à jour`)
      onDone?.()
    },
    onError: (error) => toast.error(error.message),
  })
}
