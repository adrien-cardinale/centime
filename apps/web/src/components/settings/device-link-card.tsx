import { EyeOff, QrCode, TriangleAlert } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import i18n from "@/i18n"
import { buildDeviceLink } from "@/lib/crypto/device-link"
import { createKeyStore } from "@/lib/local-db/key-store"

async function readDeviceLink(serverUrl: string | null): Promise<string> {
  const key = await (await createKeyStore()).load()
  if (key === null) throw new Error(i18n.t("settings.recoveryKey.notFound"))
  return buildDeviceLink(key, serverUrl)
}

export function DeviceLinkCard({ serverUrl }: { serverUrl: string | null }) {
  const { t } = useTranslation()
  const [link, setLink] = useState<string | null>(null)

  const toggle = async () => {
    if (link !== null) return setLink(null)
    try {
      setLink(await readDeviceLink(serverUrl))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("settings.deviceLink.buildFailed"))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.deviceLink.title")}</CardTitle>
        <CardDescription>{t("settings.deviceLink.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {serverUrl === null && (
          <Alert>
            <TriangleAlert />
            <AlertTitle>{t("settings.deviceLink.noServerTitle")}</AlertTitle>
            <AlertDescription>{t("settings.deviceLink.noServerDescription")}</AlertDescription>
          </Alert>
        )}
        {link !== null && (
          <div className="space-y-3">
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertTitle>{t("settings.deviceLink.secretTitle")}</AlertTitle>
              <AlertDescription>{t("settings.deviceLink.secretDescription")}</AlertDescription>
            </Alert>
            {/* Fond blanc et modules noirs en dur : un QR code suit le contraste du papier, pas celui du thème. */}
            <div className="w-fit rounded-md border bg-white p-3">
              <QRCodeSVG value={link} size={256} level="M" marginSize={2} bgColor="#ffffff" fgColor="#000000" />
            </div>
            <p className="text-sm text-muted-foreground">{t("settings.deviceLink.steps")}</p>
          </div>
        )}
        <Button variant="outline" onClick={() => void toggle()}>
          {link === null ? <QrCode /> : <EyeOff />}
          {link === null ? t("settings.deviceLink.show") : t("settings.deviceLink.hide")}
        </Button>
      </CardContent>
    </Card>
  )
}
