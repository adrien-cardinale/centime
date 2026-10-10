import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getLocalDatabase } from "@/lib/local-db/current-database"
import { isAndroid } from "@/lib/runtime"
import { formatFileSize } from "@/lib/sync/sync-labels"

type LocalDataCardProps = {
  onConfigureSync?: () => void
}

export function LocalDataCard({ onConfigureSync }: LocalDataCardProps) {
  const { t } = useTranslation()
  const database = getLocalDatabase()
  const onAndroid = isAndroid()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.localData.title")}</CardTitle>
        <CardDescription>{t("settings.localData.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="space-y-2">
          {!onAndroid && (
            <div className="grid gap-1 sm:grid-cols-[12rem_1fr]">
              <dt className="text-sm text-muted-foreground">{t("settings.localData.location")}</dt>
              <dd className="font-mono text-xs break-all">{database.filePath}</dd>
            </div>
          )}
          <div className="grid gap-1 sm:grid-cols-[12rem_1fr]">
            <dt className="text-sm text-muted-foreground">{t("settings.localData.size")}</dt>
            <dd className="text-sm">{formatFileSize(database.sizeInBytes())}</dd>
          </div>
        </dl>
        {onAndroid && <AndroidBackupHint onConfigureSync={onConfigureSync} />}
      </CardContent>
    </Card>
  )
}

function AndroidBackupHint({ onConfigureSync }: LocalDataCardProps) {
  const { t } = useTranslation()
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">{t("settings.localData.androidBackup")}</p>
      {onConfigureSync && (
        <Button variant="outline" className="w-full sm:w-auto" onClick={onConfigureSync}>
          {t("settings.localData.configureSync")}
        </Button>
      )}
    </div>
  )
}
