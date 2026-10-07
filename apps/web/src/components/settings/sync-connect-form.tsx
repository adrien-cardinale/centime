import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { configure } from "@/lib/sync/sync-store"

const connectSchema = z.object({
  serverUrl: z.url({ protocol: /^https?$/, error: "Adresse invalide (http:// ou https://)" }),
})

type ConnectValues = z.infer<typeof connectSchema>

export function SyncConnectForm() {
  const [connecting, setConnecting] = useState(false)
  const form = useForm<ConnectValues>({ resolver: zodResolver(connectSchema), defaultValues: { serverUrl: "" } })

  const connect = async (values: ConnectValues) => {
    setConnecting(true)
    try {
      const outcome = await configure(values.serverUrl)
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
              <FormDescription>
                Aucun compte ni mot de passe : votre clé suffit, et le serveur ne reçoit que des données chiffrées.
              </FormDescription>
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
