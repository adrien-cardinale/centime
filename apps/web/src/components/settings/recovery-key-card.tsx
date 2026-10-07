import { Copy, Eye, EyeOff } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatMasterKey } from "@/lib/crypto/master-key"
import { createKeyStore } from "@/lib/local-db/key-store"

async function readPhrase(): Promise<string> {
  const key = await (await createKeyStore()).load()
  if (key === null) throw new Error("Clé introuvable sur cet appareil")
  return formatMasterKey(key)
}

export function RecoveryKeyCard() {
  const [phrase, setPhrase] = useState<string | null>(null)

  const toggle = async () => {
    if (phrase !== null) return setPhrase(null)
    try {
      setPhrase(await readPhrase())
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Lecture de la clé impossible")
    }
  }

  const copy = async () => {
    if (phrase === null) return
    await navigator.clipboard.writeText(phrase).then(
      () => toast.success("Clé copiée"),
      () => toast.error("Copie impossible"),
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Clé de chiffrement</CardTitle>
        <CardDescription>
          Elle chiffre vos données avant leur envoi au serveur. Saisissez-la sur un autre appareil pour retrouver votre
          budget. Sans elle, les données sont irrécupérables.
        </CardDescription>
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
            {phrase === null ? "Afficher la clé" : "Masquer la clé"}
          </Button>
          {phrase !== null && (
            <Button variant="outline" onClick={() => void copy()}>
              <Copy />
              Copier
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
