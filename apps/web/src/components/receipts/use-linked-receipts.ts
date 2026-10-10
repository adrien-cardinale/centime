import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"
import type { Receipt } from "@/lib/api"
import { receiptsQuery } from "@/lib/queries"

export function useLinkedReceipts(): ReadonlyMap<string, Receipt> {
  const { data } = useQuery(receiptsQuery({ status: "linked" }))
  return useMemo(() => {
    const byTransaction = new Map<string, Receipt>()
    for (const receipt of data ?? []) {
      if (receipt.transactionId !== null && !byTransaction.has(receipt.transactionId)) {
        byTransaction.set(receipt.transactionId, receipt)
      }
    }
    return byTransaction
  }, [data])
}
