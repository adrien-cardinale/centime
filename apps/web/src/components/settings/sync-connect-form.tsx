import { zodResolver } from "@hookform/resolvers/zod"
import { hostname } from "@tauri-apps/plugin-os"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { configure } from "@/lib/sync/sync-store"

const DEFAULT_DEVICE_LABEL = "Mon ordinateur"
const SIMPLE_HOSTNAME = /^[\w.-]{1,64}$/

const connectSchema = z.object({
  serverUrl: z.url({ protocol: /^https?$/, error: "Adresse invalide (http:// ou https://)" }),
  password: z.string().min(1, "Saisissez le mot de passe"),
  label: z.string().trim().min(1, "Le libellé est obligatoire").max(100, "Libellé trop long"),
})

type ConnectValues = z.infer<typeof connectSchema>

function useDeviceLabel(): string | null {
  const [label, setLabel] = useState<string | null>(null)
  useEffect(() => {
    hostname()
      .then((name) => setLabel(name && SIMPLE_HOSTNAME.test(name) ? name : DEFAULT_DEVICE_LABEL))
      .catch(() => setLabel(DEFAULT_DEVICE_LABEL))
  }, [])
  return label
}

export function SyncConnectForm() {
  const [connecting, setConnecting] = useState(false)
  const deviceLabel = useDeviceLabel()
  const form = useForm<ConnectValues>({
    resolver: zodResolver(connectSchema),
    defaultValues: { serverUrl: "", password: "", label: DEFAULT_DEVICE_LABEL },
  })

  useEffect(() => {
    if (deviceLabel && !form.getFieldState("label").isDirty) form.setValue("label", deviceLabel)
  }, [deviceLabel, form])

  const connect = async (values: ConnectValues) => {
    setConnecting(true)
    try {
      const outcome = await configure(values)
      if (outcome.ok) toast.success("Appareil connecté et synchronisé")
      else toast.error(outcome.message)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Connexion impossible")
    } finally {
      setConnecting(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(connect)} className="max-w-md space-y-4">
        <FormField
          control={form.control}
          name="serverUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Adresse du serveur</FormLabel>
              <FormControl>
                <Input placeholder="https://centime.example.ch" autoComplete="url" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mot de passe</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="current-password" {...field} />
              </FormControl>
              <FormDescription>Il sert uniquement à obtenir un jeton d'API, il n'est pas conservé.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="label"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Libellé de l'appareil</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={connecting}>
          {connecting ? "Connexion…" : "Connecter"}
        </Button>
      </form>
    </Form>
  )
}
