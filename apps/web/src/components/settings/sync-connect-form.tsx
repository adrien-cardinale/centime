import { zodResolver } from "@hookform/resolvers/zod"
import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { configure } from "@/lib/sync/sync-store"

const createConnectSchema = (invalidUrlMessage: string) =>
  z.object({
    serverUrl: z.url({ protocol: /^https?$/, error: invalidUrlMessage }),
  })

type ConnectValues = z.infer<ReturnType<typeof createConnectSchema>>

export function SyncConnectForm() {
  const { t } = useTranslation()
  const [connecting, setConnecting] = useState(false)
  const connectSchema = useMemo(() => createConnectSchema(t("settings.sync.invalidUrl")), [t])
  const form = useForm<ConnectValues>({ resolver: zodResolver(connectSchema), defaultValues: { serverUrl: "" } })

  const connect = async (values: ConnectValues) => {
    setConnecting(true)
    try {
      const outcome = await configure(values.serverUrl)
      if (outcome.ok) toast.success(t("settings.sync.connected"))
      else toast.error(outcome.message)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("settings.sync.connectFailed"))
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
              <FormLabel>{t("settings.sync.serverAddress")}</FormLabel>
              <FormControl>
                <Input placeholder="https://centime.example.ch" autoComplete="url" {...field} />
              </FormControl>
              <FormDescription>{t("settings.sync.serverHint")}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={connecting}>
          {connecting ? t("settings.sync.connecting") : t("settings.sync.connect")}
        </Button>
      </form>
    </Form>
  )
}
