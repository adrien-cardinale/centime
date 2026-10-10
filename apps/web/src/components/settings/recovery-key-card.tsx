import { Copy, Eye, EyeOff, QrCode, TriangleAlert } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import i18n from "@/i18n"
import { getVault } from "@/lib/crypto/current-vault"
import { buildDeviceLink } from "@/lib/crypto/device-link"
import { formatMasterKey } from "@/lib/crypto/master-key"
import { createKeyStore } from "@/lib/local-db/key-store"
import { isAndroid } from "@/lib/runtime"

async function readKey() {
  const key = await (await createKeyStore(getVault().credentials.userId)).load()
  if (key === null) throw new Error(i18n.t("settings.recoveryKey.notFound"))
  return key
}

export function RecoveryKeyCard({ serverUrl }: { serverUrl: string | null }) {
  const { t } = useTranslation()
  const [phrase, setPhrase] = useState<string | null>(null)
  const [link, setLink] = useState<string | null>(null)

  const togglePhrase = async () => {
    if (phrase !== null) return setPhrase(null)
    try {
      setPhrase(await formatMasterKey(await readKey()))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("settings.recoveryKey.readFailed"))
    }
  }

  const toggleLink = async () => {
    if (link !== null) return setLink(null)
    try {
      setLink(await buildDeviceLink(await readKey(), serverUrl))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("settings.deviceLink.buildFailed"))
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(phrase ?? (await formatMasterKey(await readKey())))
      toast.success(t("settings.recoveryKey.copied"))
    } catch {
      toast.error(t("settings.recoveryKey.copyFailed"))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.recoveryKey.title")}</CardTitle>
        <CardDescription>{t("settings.recoveryKey.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {phrase !== null && (
          <p className="rounded-md border bg-muted/40 p-3 font-mono text-sm leading-relaxed break-all select-all">
            {phrase}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void togglePhrase()}>
            {phrase === null ? <Eye /> : <EyeOff />}
            {phrase === null ? t("settings.recoveryKey.show") : t("settings.recoveryKey.hide")}
          </Button>
          <Button variant="outline" onClick={() => void copy()}>
            <Copy />
            {t("common.copy")}
          </Button>
          {/* Sur Android, l'appairage se fait en scannant le QR code d'un autre appareil, pas en l'affichant. */}
          {!isAndroid() && (
            <Button variant="outline" onClick={() => void toggleLink()}>
              {link === null ? <QrCode /> : <EyeOff />}
              {link === null ? t("settings.deviceLink.show") : t("settings.deviceLink.hide")}
            </Button>
          )}
        </div>
        {link !== null && (
          <div className="space-y-3">
            {serverUrl === null && (
              <Alert>
                <TriangleAlert />
                <AlertTitle>{t("settings.deviceLink.noServerTitle")}</AlertTitle>
                <AlertDescription>{t("settings.deviceLink.noServerDescription")}</AlertDescription>
              </Alert>
            )}
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertTitle>{t("settings.deviceLink.secretTitle")}</AlertTitle>
              <AlertDescription>{t("settings.deviceLink.secretDescription")}</AlertDescription>
            </Alert>
            {/* Fond blanc et modules noirs en dur : un QR code suit le contraste du papier, pas celui du thème. */}
            <div className="w-full max-w-72 rounded-md border bg-white p-3">
              <QRCodeSVG
                value={link}
                size={256}
                level="M"
                marginSize={2}
                bgColor="#ffffff"
                fgColor="#000000"
                className="block h-auto w-full"
              />
            </div>
            <p className="text-sm text-muted-foreground">{t("settings.deviceLink.steps")}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
