import { useQuery } from "@tanstack/react-query"
import { CircleCheck, Download, ExternalLink, RefreshCw, TriangleAlert } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { RELEASES_PAGE_URL } from "@/lib/updates/github-release"
import { APP_VERSION, checkForUpdate, openDownloadUrl, updateChannel } from "@/lib/updates/update-service"

const CHECK_STALE_TIME_MS = 60 * 60 * 1000

export function UpdateCard() {
  const { t } = useTranslation()
  const channel = updateChannel()
  const [installing, setInstalling] = useState(false)
  const [ratio, setRatio] = useState<number | null>(null)

  const check = useQuery({
    queryKey: ["update-check"],
    queryFn: checkForUpdate,
    staleTime: CHECK_STALE_TIME_MS,
    refetchOnWindowFocus: false,
    retry: false,
  })

  const update = check.data?.update ?? null

  const install = async () => {
    if (!update?.install) return
    setInstalling(true)
    setRatio(null)
    try {
      await update.install(setRatio)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("settings.updates.installFailed"))
      setInstalling(false)
      setRatio(null)
    }
  }

  const download = async (url: string) => {
    try {
      await openDownloadUrl(url)
    } catch {
      toast.error(t("settings.updates.openFailed"))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.updates.title")}</CardTitle>
        <CardDescription>{t(`settings.updates.description.${channel}`)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid gap-1 sm:grid-cols-[12rem_1fr]">
          <dt className="text-sm text-muted-foreground">{t("settings.updates.installedVersion")}</dt>
          <dd className="text-sm">{APP_VERSION}</dd>
        </dl>

        {check.isError && (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertTitle>{t("settings.updates.checkFailed")}</AlertTitle>
            <AlertDescription>{check.error instanceof Error ? check.error.message : ""}</AlertDescription>
          </Alert>
        )}

        {update && (
          <Alert>
            <Download />
            <AlertTitle>{t("settings.updates.available", { version: update.version })}</AlertTitle>
            {update.notes && (
              <AlertDescription>
                <span className="max-h-40 overflow-y-auto whitespace-pre-line text-sm">{update.notes}</span>
              </AlertDescription>
            )}
          </Alert>
        )}

        {!update && check.isSuccess && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CircleCheck className="size-4" />
            {t("settings.updates.upToDate")}
          </p>
        )}

        {installing && ratio !== null && <Progress value={Math.round(ratio * 100)} />}

        <div className="flex flex-wrap gap-2">
          <Button
            variant={update ? "outline" : "default"}
            onClick={() => void check.refetch()}
            disabled={check.isFetching || installing}
          >
            <RefreshCw className={check.isFetching ? "animate-spin" : undefined} />
            {check.isFetching ? t("settings.updates.checking") : t("settings.updates.check")}
          </Button>

          {update?.install && (
            <Button onClick={() => void install()} disabled={installing}>
              <Download />
              {installing ? t("settings.updates.installing") : t("settings.updates.install")}
            </Button>
          )}

          {update && !update.install && update.downloadUrl && (
            <Button onClick={() => void download(update.downloadUrl ?? RELEASES_PAGE_URL)}>
              {channel === "android" ? <Download /> : <ExternalLink />}
              {channel === "android" ? t("settings.updates.downloadApk") : t("settings.updates.openRelease")}
            </Button>
          )}

          {check.isError && (
            <Button variant="outline" onClick={() => void download(RELEASES_PAGE_URL)}>
              <ExternalLink />
              {t("settings.updates.openRelease")}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
