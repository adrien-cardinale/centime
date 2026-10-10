import type { ReceiptUpdateInput } from "@centime/core"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import i18n from "@/i18n"
import { api, type Receipt, type ReceiptFileUpload } from "@/lib/api"
import { invalidateReceiptData } from "@/lib/queries"

type ReceiptPatch = { id: string; patch: ReceiptUpdateInput }
type ReceiptLinkRequest = { id: string; transactionId: string }

export function useCreateReceipt(onDone?: (receipt: Receipt) => void) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (upload: ReceiptFileUpload) => api.receipts.createFromFile(upload),
    onSuccess: async (receipt) => {
      await invalidateReceiptData(queryClient)
      toast.success(i18n.t("receipts.toast.saved"))
      onDone?.(receipt)
    },
    onError: (error) => toast.error(error.message),
  })
}

export function useUpdateReceipt(onDone?: (receipt: Receipt) => void) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: ReceiptPatch) => api.receipts.update(id, patch),
    onSuccess: async (receipt) => {
      await invalidateReceiptData(queryClient)
      onDone?.(receipt)
    },
    onError: (error) => toast.error(error.message),
  })
}

export function useLinkReceipt(onDone?: (receipt: Receipt) => void) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, transactionId }: ReceiptLinkRequest) => api.receipts.link(id, transactionId),
    onSuccess: async (receipt) => {
      await invalidateReceiptData(queryClient)
      toast.success(i18n.t("receipts.toast.linked"))
      onDone?.(receipt)
    },
    onError: (error) => toast.error(error.message),
  })
}

export function useUnlinkReceipt(onDone?: (receipt: Receipt) => void) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.receipts.unlink(id),
    onSuccess: async (receipt) => {
      await invalidateReceiptData(queryClient)
      toast.success(i18n.t("receipts.toast.unlinked"))
      onDone?.(receipt)
    },
    onError: (error) => toast.error(error.message),
  })
}

export function useRemoveReceipt(onDone?: () => void) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.receipts.remove(id),
    onSuccess: async () => {
      onDone?.()
      toast.success(i18n.t("receipts.toast.deleted"))
      await invalidateReceiptData(queryClient)
    },
    onError: (error) => toast.error(error.message),
  })
}

export function useApplyReceiptLines(onDone?: () => void) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.receipts.applyLines(id),
    onSuccess: async () => {
      await invalidateReceiptData(queryClient)
      toast.success(i18n.t("receipts.toast.splitApplied"))
      onDone?.()
    },
    onError: (error) => toast.error(error.message),
  })
}
