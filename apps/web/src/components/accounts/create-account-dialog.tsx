import { ACCOUNT_KINDS } from "@centime/core"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { api } from "@/lib/api"
import { accountKindLabels } from "@/lib/labels"
import { accountsQuery } from "@/lib/queries"

const accountFormSchema = z.object({
  name: z.string().trim().min(1, "Le nom est obligatoire"),
  kind: z.enum(ACCOUNT_KINDS),
  identifier: z.string().trim().min(1, "L'identifiant est obligatoire"),
  currency: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/, "Code ISO à trois lettres"),
})

type AccountFormValues = z.infer<typeof accountFormSchema>

const defaultValues: AccountFormValues = { name: "", kind: "bank", identifier: "", currency: "CHF" }

export function CreateAccountDialog() {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const form = useForm<AccountFormValues>({ resolver: zodResolver(accountFormSchema), defaultValues })

  const createAccount = useMutation({
    mutationFn: api.accounts.create,
    onSuccess: async (account) => {
      await queryClient.invalidateQueries({ queryKey: accountsQuery.queryKey })
      toast.success(`Compte « ${account.name} » créé`)
      form.reset(defaultValues)
      setOpen(false)
    },
    onError: (error) => toast.error(error.message),
  })

  const submit = form.handleSubmit((values) =>
    createAccount.mutate({ ...values, currency: values.currency.toUpperCase() }),
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          Nouveau compte
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouveau compte</DialogTitle>
          <DialogDescription>Ajoutez un compte bancaire ou une carte.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={submit} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom</FormLabel>
                  <FormControl>
                    <Input placeholder="Compte courant" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="kind"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ACCOUNT_KINDS.map((kind) => (
                        <SelectItem key={kind} value={kind}>
                          {accountKindLabels[kind]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="identifier"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>IBAN ou numéro de carte masqué</FormLabel>
                  <FormControl>
                    <Input placeholder="CH93 0076 2011 6238 5295 7" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Devise</FormLabel>
                  <FormControl>
                    <Input maxLength={3} className="uppercase" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={createAccount.isPending}>
                {createAccount.isPending ? "Création…" : "Créer"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
