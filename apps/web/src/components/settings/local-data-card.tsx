import { useTranslation } from "react-i18next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getLocalDatabase } from "@/lib/local-db/current-database"
import { formatFileSize } from "@/lib/sync/sync-labels"

export function LocalDataCard() {
  const { t } = useTranslation()
  const database = getLocalDatabase()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.localData.title")}</CardTitle>
        <CardDescription>{t("settings.localData.description")}</CardDescription>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  )
}
