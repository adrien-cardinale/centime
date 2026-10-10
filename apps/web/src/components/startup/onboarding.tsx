import { Check, Copy, KeyRound, Plus } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useIsMobile } from "@/hooks/use-mobile"
import { completeOnboarding } from "@/lib/crypto/onboarding"
import { formatMasterKey, generateMasterKey, parseMasterKey } from "@/lib/crypto/master-key"
import { isAndroid, isStaticBuild, isTauri } from "@/lib/runtime"
import { parseServerUrl } from "@/lib/sync/server-url"
import { ScanLinkButton } from "./scan-link-button"

type Mode = "choose" | "create" | "restore"

function ServerField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t } = useTranslation()
  if (!isTauri() && !isStaticBuild()) return null
  return (
    <div className="space-y-2">
      <Label htmlFor="server-url">{t("boot.serverLabel")}</Label>
      <Input
        id="server-url"
        type="url"
        inputMode="url"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="https://centime.example.ch"
        autoComplete="url"
      />
      <p className="text-sm text-muted-foreground">{t("boot.serverHint")}</p>
    </div>
  )
}

type StepProps = { onDone: () => void; onBack: () => void }

const STEP_FOOTER_CLASS = "flex-col-reverse gap-2 sm:flex-row"
const STEP_BUTTON_CLASS = "w-full sm:w-auto"

function CreateKeyStep({ onDone, onBack }: StepProps) {
  const { t } = useTranslation()
  const [key] = useState(generateMasterKey)
  const [phrase, setPhrase] = useState("")
  const [saved, setSaved] = useState(false)
  const [serverUrl, setServerUrlValue] = useState("")
  const [pending, setPending] = useState(false)

  useEffect(() => {
    void formatMasterKey(key).then(setPhrase)
  }, [key])

  const copy = async () => {
    await navigator.clipboard.writeText(phrase).then(
      () => toast.success(t("boot.keyCopied")),
      () => toast.error(t("boot.copyFailed")),
    )
  }

  const submit = async () => {
    const url = parseServerUrl(serverUrl)
    if (serverUrl.trim() !== "" && url === null) return void toast.error(t("boot.invalidServer"))
    setPending(true)
    try {
      await completeOnboarding(key, url)
      onDone()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("boot.saveFailed"))
      setPending(false)
    }
  }

  return (
    <>
      <CardContent className="space-y-4">
        <Alert>
          <KeyRound />
          <AlertTitle>{t("boot.warningTitle")}</AlertTitle>
          <AlertDescription>
            {t("boot.warningDescription")}
          </AlertDescription>
        </Alert>
        <div className="space-y-2">
          <p className="rounded-md border bg-muted/40 p-3 font-mono text-sm leading-relaxed break-words select-all">
            {phrase}
          </p>
          <Button variant="outline" className="w-full" onClick={() => void copy()} aria-label={t("boot.copyKey")}>
            <Copy />
            {t("common.copy")}
          </Button>
        </div>
        <ServerField value={serverUrl} onChange={setServerUrlValue} />
        <div className="flex items-center gap-2">
          <Checkbox id="saved" checked={saved} onCheckedChange={(value) => setSaved(value === true)} />
          <Label htmlFor="saved">{t("boot.savedConfirm")}</Label>
        </div>
      </CardContent>
      <CardFooter className={STEP_FOOTER_CLASS}>
        <Button variant="outline" className={STEP_BUTTON_CLASS} onClick={onBack} disabled={pending}>
          {t("boot.back")}
        </Button>
        <Button className={STEP_BUTTON_CLASS} onClick={() => void submit()} disabled={!saved || phrase === "" || pending}>
          <Check />
          {t("boot.continue")}
        </Button>
      </CardFooter>
    </>
  )
}

function RestoreKeyStep({ onDone, onBack }: StepProps) {
  const { t } = useTranslation()
  const [phrase, setPhrase] = useState("")
  const [serverUrl, setServerUrlValue] = useState("")
  const [pending, setPending] = useState(false)
  const isMobile = useIsMobile()

  const submit = async () => {
    const url = parseServerUrl(serverUrl)
    if (serverUrl.trim() !== "" && url === null) return void toast.error(t("boot.invalidServer"))
    setPending(true)
    try {
      await completeOnboarding(await parseMasterKey(phrase), url)
      onDone()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("boot.invalidKey"))
      setPending(false)
    }
  }

  return (
    <>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="phrase">{t("boot.yourKey")}</Label>
          <Textarea
            id="phrase"
            value={phrase}
            onChange={(event) => setPhrase(event.target.value)}
            className="font-mono"
            rows={3}
            autoFocus={!isMobile && !isAndroid()}
            spellCheck={false}
            autoCapitalize="characters"
          />
        </div>
        <ServerField value={serverUrl} onChange={setServerUrlValue} />
      </CardContent>
      <CardFooter className={STEP_FOOTER_CLASS}>
        <Button variant="outline" className={STEP_BUTTON_CLASS} onClick={onBack} disabled={pending}>
          {t("boot.back")}
        </Button>
        <Button className={STEP_BUTTON_CLASS} onClick={() => void submit()} disabled={phrase.trim() === "" || pending}>
          <Check />
          {t("boot.restore")}
        </Button>
      </CardFooter>
    </>
  )
}

export function Onboarding({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<Mode>("choose")
  const back = () => setMode("choose")

  return (
    <main className="flex min-h-svh items-start justify-center bg-muted/40 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:items-center sm:px-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-xl">centime</CardTitle>
          <CardDescription>
            {t("boot.intro")}
          </CardDescription>
        </CardHeader>
        {mode === "choose" && (
          <CardContent className="flex flex-col gap-2">
            {/* Sur Android, le QR code d'un appareil déjà configuré évite de saisir la clé à la main. */}
            {isAndroid() && (
              <>
                <p className="text-sm text-muted-foreground">{t("boot.scan.hint")}</p>
                <ScanLinkButton onDone={onDone} />
              </>
            )}
            <Button variant={isAndroid() ? "outline" : "default"} onClick={() => setMode("create")}>
              <Plus />
              {t("boot.createKey")}
            </Button>
            <Button variant="outline" onClick={() => setMode("restore")}>
              <KeyRound />
              {isAndroid() ? t("boot.enterKeyManually") : t("boot.haveKey")}
            </Button>
          </CardContent>
        )}
        {mode === "create" && <CreateKeyStep onDone={onDone} onBack={back} />}
        {mode === "restore" && <RestoreKeyStep onDone={onDone} onBack={back} />}
      </Card>
    </main>
  )
}
