import { Check, Copy, KeyRound, Plus } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { completeOnboarding } from "@/lib/crypto/onboarding"
import { formatMasterKey, generateMasterKey, parseMasterKey } from "@/lib/crypto/master-key"
import { isTauri } from "@/lib/runtime"

type Mode = "choose" | "create" | "restore"

function normalizeUrl(value: string): string | null {
  const trimmed = value.trim()
  if (trimmed === "") return null
  try {
    const url = new URL(trimmed)
    return url.protocol === "http:" || url.protocol === "https:" ? trimmed : null
  } catch {
    return null
  }
}

function ServerField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  if (!isTauri()) return null
  return (
    <div className="space-y-2">
      <Label htmlFor="server-url">Serveur de synchronisation (facultatif)</Label>
      <Input
        id="server-url"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="https://centime.example.ch"
        autoComplete="url"
      />
      <p className="text-sm text-muted-foreground">Laissez vide pour n'utiliser que cet appareil. Modifiable plus tard.</p>
    </div>
  )
}

type StepProps = { onDone: () => void; onBack: () => void }

function CreateKeyStep({ onDone, onBack }: StepProps) {
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
      () => toast.success("Clé copiée"),
      () => toast.error("Copie impossible, notez la clé à la main"),
    )
  }

  const submit = async () => {
    const url = normalizeUrl(serverUrl)
    if (serverUrl.trim() !== "" && url === null) return void toast.error("Adresse du serveur invalide")
    setPending(true)
    try {
      await completeOnboarding(key, url)
      onDone()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Enregistrement de la clé impossible")
      setPending(false)
    }
  }

  return (
    <>
      <CardContent className="space-y-4">
        <Alert>
          <KeyRound />
          <AlertTitle>Votre clé est la seule façon de retrouver vos données</AlertTitle>
          <AlertDescription>
            Elle chiffre vos données avant leur envoi : le serveur ne peut pas les lire et personne ne peut vous la
            redonner. Conservez-la dans un gestionnaire de mots de passe ou sur papier.
          </AlertDescription>
        </Alert>
        <div className="flex items-start gap-2 rounded-md border bg-muted/40 p-3">
          <p className="flex-1 font-mono text-sm leading-relaxed break-all select-all">{phrase}</p>
          <Button variant="outline" size="icon" onClick={() => void copy()} aria-label="Copier la clé">
            <Copy />
          </Button>
        </div>
        <ServerField value={serverUrl} onChange={setServerUrlValue} />
        <div className="flex items-center gap-2">
          <Checkbox id="saved" checked={saved} onCheckedChange={(value) => setSaved(value === true)} />
          <Label htmlFor="saved">J'ai sauvegardé ma clé</Label>
        </div>
      </CardContent>
      <CardFooter className="gap-2">
        <Button variant="outline" onClick={onBack} disabled={pending}>
          Retour
        </Button>
        <Button onClick={() => void submit()} disabled={!saved || phrase === "" || pending}>
          <Check />
          Continuer
        </Button>
      </CardFooter>
    </>
  )
}

function RestoreKeyStep({ onDone, onBack }: StepProps) {
  const [phrase, setPhrase] = useState("")
  const [serverUrl, setServerUrlValue] = useState("")
  const [pending, setPending] = useState(false)

  const submit = async () => {
    const url = normalizeUrl(serverUrl)
    if (serverUrl.trim() !== "" && url === null) return void toast.error("Adresse du serveur invalide")
    setPending(true)
    try {
      await completeOnboarding(await parseMasterKey(phrase), url)
      onDone()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Clé invalide")
      setPending(false)
    }
  }

  return (
    <>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="phrase">Votre clé</Label>
          <Textarea
            id="phrase"
            value={phrase}
            onChange={(event) => setPhrase(event.target.value)}
            className="font-mono"
            rows={3}
            autoFocus
            spellCheck={false}
            autoCapitalize="characters"
          />
        </div>
        <ServerField value={serverUrl} onChange={setServerUrlValue} />
      </CardContent>
      <CardFooter className="gap-2">
        <Button variant="outline" onClick={onBack} disabled={pending}>
          Retour
        </Button>
        <Button onClick={() => void submit()} disabled={phrase.trim() === "" || pending}>
          <Check />
          Restaurer
        </Button>
      </CardFooter>
    </>
  )
}

export function Onboarding({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<Mode>("choose")
  const back = () => setMode("choose")

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 p-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-xl">centime</CardTitle>
          <CardDescription>
            Pas de compte : une clé secrète, générée ici, chiffre vos données sur votre appareil.
          </CardDescription>
        </CardHeader>
        {mode === "choose" && (
          <CardContent className="flex flex-col gap-2">
            <Button onClick={() => setMode("create")}>
              <Plus />
              Créer une nouvelle clé
            </Button>
            <Button variant="outline" onClick={() => setMode("restore")}>
              <KeyRound />
              J'ai déjà une clé
            </Button>
          </CardContent>
        )}
        {mode === "create" && <CreateKeyStep onDone={onDone} onBack={back} />}
        {mode === "restore" && <RestoreKeyStep onDone={onDone} onBack={back} />}
      </Card>
    </main>
  )
}
