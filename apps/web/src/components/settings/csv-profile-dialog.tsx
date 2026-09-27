import type { CsvProfileInput } from "@centime/core"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { type ReactNode, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { api, type CsvProfile } from "@/lib/api"
import {
  type CsvProfileFormValues,
  csvProfileFormSchema,
  csvProfileToFormValues,
  emptyCsvProfileFormValues,
} from "@/lib/csv-profile-form"
import {
  accountKindLabels,
  amountModeLabels,
  csvDelimiterLabels,
  csvEncodingLabels,
  decimalSeparatorLabels,
} from "@/lib/labels"
import { csvProfilesQuery } from "@/lib/queries"
import { type CsvProfileControl, SelectField, TextField } from "./csv-profile-fields"
import { CsvProfileStatuses } from "./csv-profile-statuses"

type CsvProfileDialogProps = {
  profile?: CsvProfile
  trigger: ReactNode
}

function saveProfile(profile: CsvProfile | undefined, input: CsvProfileInput) {
  return profile ? api.csvProfiles.update(profile.id, input) : api.csvProfiles.create(input)
}

export function CsvProfileDialog({ profile, trigger }: CsvProfileDialogProps) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const initialValues = profile ? csvProfileToFormValues(profile) : emptyCsvProfileFormValues
  const form = useForm<CsvProfileFormValues, unknown, CsvProfileInput>({
    resolver: zodResolver(csvProfileFormSchema),
    defaultValues: initialValues,
  })

  const save = useMutation({
    mutationFn: (input: CsvProfileInput) => saveProfile(profile, input),
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: csvProfilesQuery.queryKey })
      toast.success(`Profil « ${saved.name} » enregistré`)
      setOpen(false)
    },
    onError: (error) => toast.error(error.message),
  })

  const changeOpen = (next: boolean) => {
    if (next) form.reset(initialValues)
    setOpen(next)
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{profile ? "Modifier le profil CSV" : "Nouveau profil CSV"}</DialogTitle>
          <DialogDescription>Décrivez la structure des exports CSV de votre fournisseur.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((input) => save.mutate(input))} className="space-y-6">
            <GeneralSection control={form.control} />
            <Separator />
            <ColumnsSection control={form.control} />
            <Separator />
            <AmountSection control={form.control} />
            <Separator />
            <DetectionSection control={form.control} />
            <DialogFooter>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  )
}

function GeneralSection({ control }: { control: CsvProfileControl }) {
  return (
    <Section title="Général">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField control={control} name="name" label="Nom" placeholder="Ma banque" />
        <SelectField control={control} name="accountKind" label="Type de compte" options={accountKindLabels} />
        <SelectField control={control} name="encoding" label="Encodage" options={csvEncodingLabels} />
        <SelectField control={control} name="delimiter" label="Séparateur" options={csvDelimiterLabels} />
        <TextField
          control={control}
          name="dateFormat"
          label="Format de date"
          placeholder="dd.MM.yyyy"
          description="Syntaxe date-fns, par exemple yyyy-MM-dd."
        />
        <SelectField
          control={control}
          name="decimalSeparator"
          label="Séparateur décimal"
          options={decimalSeparatorLabels}
        />
        <TextField control={control} name="defaultCurrency" label="Devise par défaut" placeholder="CHF" />
        <HasHeaderField control={control} />
      </div>
    </Section>
  )
}

function HasHeaderField({ control }: { control: CsvProfileControl }) {
  return (
    <FormField
      control={control}
      name="hasHeader"
      render={({ field }) => (
        <FormItem className="flex items-center gap-2 self-end pb-2">
          <FormControl>
            <Checkbox checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} />
          </FormControl>
          <FormLabel>Première ligne = en-têtes</FormLabel>
        </FormItem>
      )}
    />
  )
}

function ColumnsSection({ control }: { control: CsvProfileControl }) {
  return (
    <Section title="Colonnes">
      <p className="text-sm text-muted-foreground">
        Nom exact de l'en-tête, ou position à partir de 1 si le fichier n'a pas d'en-têtes.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField control={control} name="columns.date" label="Date de comptabilisation *" />
        <TextField control={control} name="columns.label" label="Libellé *" />
        <TextField control={control} name="columns.valueDate" label="Date valeur" />
        <TextField control={control} name="columns.merchant" label="Commerçant" />
        <TextField control={control} name="columns.account" label="Compte (IBAN ou carte)" />
        <TextField control={control} name="columns.currency" label="Devise" />
        <TextField control={control} name="columns.balance" label="Solde" />
        <TextField control={control} name="columns.category" label="Catégorie du fournisseur" />
        <TextField control={control} name="columns.status" label="Statut" />
      </div>
    </Section>
  )
}

function AmountSection({ control }: { control: CsvProfileControl }) {
  const mode = useWatch({ control, name: "amount.mode" })

  return (
    <Section title="Montant">
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField control={control} name="amount.mode" label="Mode" options={amountModeLabels} />
        <TextField control={control} name="amount.column" label="Colonne du montant" />
        {mode === "debitCredit" && (
          <>
            <TextField control={control} name="amount.indicatorColumn" label="Colonne débit/crédit" />
            <TextField
              control={control}
              name="amount.debitValue"
              label="Valeur signalant un débit"
              placeholder="Débit"
            />
          </>
        )}
      </div>
    </Section>
  )
}

function DetectionSection({ control }: { control: CsvProfileControl }) {
  return (
    <>
      <Section title="Détection automatique">
        <FormField
          control={control}
          name="detect.requiredHeaders"
          render={({ field }) => (
            <FormItem>
              <FormLabel>En-têtes requis</FormLabel>
              <FormControl>
                <Textarea rows={4} placeholder={"IBAN\nBooked At"} {...field} />
              </FormControl>
              <FormDescription>Un en-tête par ligne. Le profil est choisi si tous sont présents.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </Section>
      <Separator />
      <Section title="Statuts">
        <CsvProfileStatuses control={control} />
      </Section>
    </>
  )
}
