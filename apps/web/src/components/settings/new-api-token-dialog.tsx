import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Check, Copy, Plus } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { api } from "@/lib/api"
import { apiTokensQuery } from "@/lib/queries"

const tokenFormSchema = z.object({
  label: z.string().trim().min(1, "Le libellé est obligatoire").max(100, "Libellé trop long"),
  password: z.string().min(1, "Saisissez le mot de passe"),
})

type TokenFormValues = z.infer<typeof tokenFormSchema>

const EMPTY_VALUES: TokenFormValues = { label: "", password: "" }

export function NewApiTokenDialog() {
  const [open, setOpen] = useState(false)
  const [createdToken, setCreatedToken] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const form = useForm<TokenFormValues>({ resolver: zodResolver(tokenFormSchema), defaultValues: EMPTY_VALUES })

  const create = useMutation({
    mutationFn: (values: TokenFormValues) => api.auth.token(values.password, values.label),
    onSuccess: async (created) => {
      setCreatedToken(created.token)
      await queryClient.invalidateQueries({ queryKey: apiTokensQuery.queryKey })
    },
    onError: (error) => toast.error(error.message),
  })

  const changeOpen = (next: boolean) => {
    setOpen(next)
    if (next) return
    form.reset(EMPTY_VALUES)
    setCreatedToken(null)
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          Nouveau jeton
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouveau jeton d'API</DialogTitle>
          <DialogDescription>
            {createdToken
              ? "Copiez ce jeton maintenant : il ne sera plus affiché."
              : "Confirmez avec le mot de passe de l'application."}
          </DialogDescription>
        </DialogHeader>
        {createdToken ? (
          <CreatedToken token={createdToken} onClose={() => changeOpen(false)} />
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit((values) => create.mutate(values))} className="space-y-4">
              <FormField
                control={form.control}
                name="label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Libellé</FormLabel>
                    <FormControl>
                      <Input placeholder="Ordinateur portable" autoFocus {...field} />
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
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={create.isPending}>
                  {create.isPending ? "Création…" : "Créer le jeton"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  )
}

function CreatedToken({ token, onClose }: { token: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(token)
      setCopied(true)
    } catch {
      toast.error("Copie impossible, sélectionnez le jeton manuellement")
    }
  }

  return (
    <div className="space-y-4">
      <Alert>
        <AlertDescription className="font-mono text-xs break-all select-all">{token}</AlertDescription>
      </Alert>
      <DialogFooter>
        <Button variant="outline" onClick={() => void copy()}>
          {copied ? <Check /> : <Copy />}
          {copied ? "Copié" : "Copier"}
        </Button>
        <Button onClick={onClose}>Terminé</Button>
      </DialogFooter>
    </div>
  )
}
