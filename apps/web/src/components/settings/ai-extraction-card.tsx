import { Eye, EyeOff, ShieldAlert } from "lucide-react"
import { type FormEvent, useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import {
  type AiExtractionSettings,
  DEFAULT_AI_MODEL,
  SUGGESTED_AI_MODELS,
  useAiExtractionSettings,
  useSaveAiExtractionSettings,
} from "@/lib/receipts/ai-settings"
import { isTauri } from "@/lib/runtime"

const ANTHROPIC_CONSOLE_URL = "https://console.anthropic.com/"

export function AiExtractionCard() {
  const { t } = useTranslation()
  const { settings, isLoading } = useAiExtractionSettings()
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.ai.title")}</CardTitle>
        <CardDescription>{t("settings.ai.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? <Skeleton className="h-40 w-full" /> : <AiExtractionForm initialSettings={settings} />}
      </CardContent>
    </Card>
  )
}

function AiExtractionForm({ initialSettings }: { initialSettings: AiExtractionSettings }) {
  const { t } = useTranslation()
  const ids = { enabled: useId(), apiKey: useId(), model: useId(), models: useId() }
  const [draft, setDraft] = useState(initialSettings)
  const [keyVisible, setKeyVisible] = useState(false)
  const save = useSaveAiExtractionSettings()

  const update = (changes: Partial<AiExtractionSettings>) => setDraft((current) => ({ ...current, ...changes }))

  const submit = (event: FormEvent) => {
    event.preventDefault()
    save.mutate(draft, {
      onSuccess: () => toast.success(t("settings.ai.saved")),
      onError: () => toast.error(t("settings.ai.saveFailed")),
    })
  }

  const fieldsDisabled = !draft.enabled

  return (
    <form onSubmit={submit} className="max-w-md space-y-4">
      <Alert>
        <ShieldAlert />
        <AlertDescription>{t("settings.ai.privacy")}</AlertDescription>
      </Alert>
      <div className="flex items-center gap-3">
        <Switch id={ids.enabled} checked={draft.enabled} onCheckedChange={(enabled) => update({ enabled })} />
        <Label htmlFor={ids.enabled}>{t("settings.ai.enable")}</Label>
      </div>
      <div className="space-y-2">
        <Label htmlFor={ids.apiKey}>{t("settings.ai.apiKey")}</Label>
        <div className="flex gap-2">
          <Input
            id={ids.apiKey}
            type={keyVisible ? "text" : "password"}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="sk-ant-…"
            value={draft.apiKey}
            disabled={fieldsDisabled}
            onChange={(event) => update({ apiKey: event.target.value })}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={fieldsDisabled}
            aria-label={keyVisible ? t("settings.ai.hideKey") : t("settings.ai.showKey")}
            onClick={() => setKeyVisible((visible) => !visible)}
          >
            {keyVisible ? <EyeOff /> : <Eye />}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {t("settings.ai.apiKeyHint")} <ConsoleLink />
        </p>
        {draft.enabled && draft.apiKey.trim() === "" && (
          <p className="text-sm text-destructive">{t("settings.ai.keyMissing")}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor={ids.model}>{t("settings.ai.model")}</Label>
        <Input
          id={ids.model}
          list={ids.models}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder={DEFAULT_AI_MODEL}
          value={draft.model}
          disabled={fieldsDisabled}
          onChange={(event) => update({ model: event.target.value })}
        />
        <datalist id={ids.models}>
          {SUGGESTED_AI_MODELS.map((model) => (
            <option key={model} value={model} />
          ))}
        </datalist>
        <p className="text-sm text-muted-foreground">{t("settings.ai.modelHint")}</p>
      </div>
      <Button type="submit" disabled={save.isPending}>
        {t("settings.ai.save")}
      </Button>
    </form>
  )
}

function ConsoleLink() {
  if (isTauri()) return <span className="font-mono select-all">{ANTHROPIC_CONSOLE_URL}</span>
  return (
    <a href={ANTHROPIC_CONSOLE_URL} target="_blank" rel="noreferrer" className="underline underline-offset-4">
      {ANTHROPIC_CONSOLE_URL}
    </a>
  )
}
