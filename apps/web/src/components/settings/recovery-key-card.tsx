import { Copy, Eye, EyeOff } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import i18n from "@/i18n"
import { formatMasterKey } from "@/lib/crypto/master-key"
import { createKeyStore } from "@/lib/local-db/key-store"

async function readPhrase(): Promise<string> {
  const key = await (await createKeyStore()).load()
  if (key === null) throw new Error(i18n.t("settings.recoveryKey.notFound"))
  return formatMasterKey(key)
}

export function RecoveryKeyCard() {
  const { t } = useTranslation()
  const [phrase, setPhrase] = useState<string | null>(null)

  const toggle = async () => {
    if (phrase !== null) return setPhrase(null)
    try {
      setPhrase(await readPhrase())
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("settings.recoveryKey.readFailed"))
    }
  }

  const copy = async () => {
    if (phrase === null) return
    await navigator.clipboard.writeText(phrase).then(
      () => toast.success(t("settings.recoveryKey.copied")),
      () => toast.error(t("settings.recoveryKey.copyFailed")),
    )
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
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void toggle()}>
            {phrase === null ? <Eye /> : <EyeOff />}
            {phrase === null ? t("settings.recoveryKey.show") : t("settings.recoveryKey.hide")}
          </Button>
          {phrase !== null && (
            <Button variant="outline" onClick={() => void copy()}>
              <Copy />
              {t("common.copy")}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
