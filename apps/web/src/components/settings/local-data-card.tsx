import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { DatabaseZap } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getLocalDatabase } from "@/lib/local-db/current-database"
import { countDefaultData, createDefaultData, lacksDefaultData } from "@/lib/local-db/local-data"
import { formatFileSize } from "@/lib/sync/sync-labels"
import { refreshSyncState } from "@/lib/sync/sync-store"

const localDataQueryKey = ["local-data", "default-counts"]

export function LocalDataCard({ neverSynced }: { neverSynced: boolean }) {
  const { t } = useTranslation()
  const database = getLocalDatabase()
  const queryClient = useQueryClient()
  const counts = useQuery({
    queryKey: localDataQueryKey,
    queryFn: () => database.run(countDefaultData),
  })

  const seed = useMutation({
    mutationFn: async () => {
      await database.run(createDefaultData)
      await database.flush()
    },
    onSuccess: async () => {
      toast.success(t("settings.localData.seeded"))
      await Promise.all([queryClient.invalidateQueries(), refreshSyncState()])
    },
    onError: (error) => toast.error(error.message),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.localData.title")}</CardTitle>
        <CardDescription>{t("settings.localData.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="space-y-2">
          <div className="grid gap-1 sm:grid-cols-[12rem_1fr]">
            <dt className="text-sm text-muted-foreground">{t("settings.localData.location")}</dt>
            <dd className="font-mono text-xs break-all">{database.filePath}</dd>
          </div>
          <div className="grid gap-1 sm:grid-cols-[12rem_1fr]">
            <dt className="text-sm text-muted-foreground">{t("settings.localData.size")}</dt>
            <dd className="text-sm">{formatFileSize(database.sizeInBytes())}</dd>
          </div>
        </dl>
        {neverSynced && (
          <p className="text-sm text-muted-foreground">{t("settings.localData.seedHint")}</p>
        )}
        {counts.isPending && <Skeleton className="h-9 w-56" />}
        {counts.data && lacksDefaultData(counts.data) && (
          <Button variant="outline" onClick={() => seed.mutate()} disabled={seed.isPending}>
            <DatabaseZap />
            {t("settings.localData.seed")}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
