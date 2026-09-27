import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Plus } from "lucide-react"
import { useState } from "react"
import { FixedItemDialog } from "@/components/fixed-items/fixed-item-dialog"
import { FixedItemSheet } from "@/components/fixed-items/fixed-item-sheet"
import { FixedItemsSummary } from "@/components/fixed-items/fixed-items-summary"
import { FixedItemsTable } from "@/components/fixed-items/fixed-items-table"
import { UpcomingOccurrences } from "@/components/fixed-items/upcoming-occurrences"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { FixedItem, FixedItemsOverview } from "@/lib/api"
import { currentOverviewRange } from "@/lib/fixed-items"
import { categoriesQuery, fixedItemsOverviewQuery, fixedItemsQuery } from "@/lib/queries"

export const Route = createFileRoute("/_app/fixed-items")({
  loader: ({ context }) => {
    const { from, to } = currentOverviewRange()
    return Promise.all([
      context.queryClient.prefetchQuery(fixedItemsQuery),
      context.queryClient.prefetchQuery(fixedItemsOverviewQuery(from, to)),
      context.queryClient.prefetchQuery(categoriesQuery),
    ])
  },
  component: FixedItemsPage,
})

function FixedItemsPage() {
  const [range] = useState(currentOverviewRange)
  const items = useQuery(fixedItemsQuery)
  const overview = useQuery(fixedItemsOverviewQuery(range.from, range.to))
  const error = items.error ?? overview.error

  return (
    <div className="space-y-6">
      <PageHeader
        title="Postes fixes"
        description="Dépenses et revenus récurrents, comparés échéance par échéance aux transactions réelles."
        actions={
          <FixedItemDialog
            trigger={
              <Button>
                <Plus />
                Nouveau poste
              </Button>
            }
          />
        }
      />
      {error && <p className="text-sm text-destructive">{error.message}</p>}
      {items.data && overview.data ? (
        <FixedItemsContent items={items.data} overview={overview.data} />
      ) : (
        !error && <FixedItemsSkeleton />
      )}
    </div>
  )
}

function FixedItemsContent({ items, overview }: { items: FixedItem[]; overview: FixedItemsOverview }) {
  const [viewedId, setViewedId] = useState<string | null>(null)
  const overviews = new Map(overview.items.map((entry) => [entry.fixedItemId, entry]))
  const viewed = items.find((item) => item.id === viewedId)

  return (
    <>
      <FixedItemsSummary totals={overview.totals} />
      <Card className="py-0">
        <CardContent className="px-0">
          <FixedItemsTable items={items} overviews={overviews} today={overview.today} onView={setViewedId} />
        </CardContent>
      </Card>
      <UpcomingOccurrences items={items} overviews={overview.items} today={overview.today} onView={setViewedId} />
      <FixedItemSheet
        item={viewed}
        overview={viewed ? overviews.get(viewed.id) : undefined}
        onOpenChange={(open) => !open && setViewedId(null)}
      />
    </>
  )
}

function FixedItemsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-48" />
    </div>
  )
}
