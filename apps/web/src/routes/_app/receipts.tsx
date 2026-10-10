import type { ReceiptStatus } from "@centime/core"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Plus, Wand2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { PageHeader } from "@/components/page-header"
import { ReceiptCard } from "@/components/receipts/receipt-card"
import { ReceiptDialog } from "@/components/receipts/receipt-dialog"
import { ReceiptSheet } from "@/components/receipts/receipt-sheet"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { api, type Receipt } from "@/lib/api"
import { accountsQuery, categoriesQuery, invalidateReceiptData, receiptsQuery } from "@/lib/queries"

const STATUSES = ["pending", "linked", "ignored"] as const satisfies readonly ReceiptStatus[]

export const Route = createFileRoute("/_app/receipts")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.prefetchQuery(accountsQuery),
      context.queryClient.prefetchQuery(categoriesQuery),
    ]),
  component: ReceiptsPage,
})

function isReceiptStatus(value: string): value is ReceiptStatus {
  return (STATUSES as readonly string[]).includes(value)
}

function ReceiptsPage() {
  const { t } = useTranslation()
  const [status, setStatus] = useState<ReceiptStatus>("pending")
  const [capturing, setCapturing] = useState(false)
  const [openedId, setOpenedId] = useState<string | null>(null)
  const { data, isPending, error } = useQuery(receiptsQuery({ status }))

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("receipts.title")}
        description={t("receipts.description")}
        actions={
          <Button onClick={() => setCapturing(true)}>
            <Plus />
            {t("receipts.add")}
          </Button>
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={status} onValueChange={(next) => isReceiptStatus(next) && setStatus(next)}>
          <TabsList>
            {STATUSES.map((value) => (
              <TabsTrigger key={value} value={value}>
                {t(`receipts.tabs.${value}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {status === "pending" && data && data.length > 0 && <AutoMatchButton receipts={data} />}
      </div>
      {isPending && <ReceiptsSkeleton />}
      {error && <p className="text-sm text-destructive">{error.message}</p>}
      {data && data.length === 0 && <EmptyState status={status} onAdd={() => setCapturing(true)} />}
      {data && data.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {data.map((receipt) => (
            <li key={receipt.id}>
              <ReceiptCard receipt={receipt} onOpen={(opened) => setOpenedId(opened.id)} />
            </li>
          ))}
        </ul>
      )}
      <ReceiptDialog open={capturing} onOpenChange={setCapturing} />
      <ReceiptSheet receiptId={openedId} onOpenChange={(open) => !open && setOpenedId(null)} />
    </div>
  )
}

function AutoMatchButton({ receipts }: { receipts: Receipt[] }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const accountIds = [...new Set(receipts.map((receipt) => receipt.accountId))]
  const match = useMutation({
    mutationFn: async () => (await Promise.all(accountIds.map((id) => api.receipts.matchPending(id)))).flat().length,
    onSuccess: async (count) => {
      await invalidateReceiptData(queryClient)
      toast.success(t("receipts.autoMatch.done", { count }))
    },
    onError: (error) => toast.error(error.message),
  })
  return (
    <Button variant="outline" onClick={() => match.mutate()} disabled={match.isPending}>
      <Wand2 />
      {match.isPending ? t("receipts.autoMatch.running") : t("receipts.autoMatch.action")}
    </Button>
  )
}

function EmptyState({ status, onAdd }: { status: ReceiptStatus; onAdd: () => void }) {
  const { t } = useTranslation()
  if (status !== "pending") {
    return <p className="py-10 text-center text-sm text-muted-foreground">{t(`receipts.empty.${status}`)}</p>
  }
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-10 text-center">
      <p className="max-w-md text-sm text-muted-foreground">{t("receipts.empty.pending")}</p>
      <Button onClick={onAdd}>
        <Plus />
        {t("receipts.add")}
      </Button>
    </div>
  )
}

function ReceiptsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      <Skeleton className="aspect-[3/4] w-full" />
      <Skeleton className="aspect-[3/4] w-full" />
    </div>
  )
}
