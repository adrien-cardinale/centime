import { type CsvColumnChoice, type CsvProfileInput, listCsvColumns } from "@centime/core"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { type ReactNode, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
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
import i18n from "@/i18n"
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
import { csvSampleQuery, invalidateCsvProfileData } from "@/lib/queries"
import { ColumnField, type CsvProfileControl, SelectField, TextField } from "./csv-profile-fields"
import { CsvProfileStatuses } from "./csv-profile-statuses"

type CsvProfileDialogProps = {
  profile?: CsvProfile
  trigger: ReactNode
  sourceFile?: File
  onSaved?: (profile: CsvProfile) => void
}

function saveProfile(profile: CsvProfile | undefined, input: CsvProfileInput) {
  return profile ? api.csvProfiles.update(profile.id, input) : api.csvProfiles.create(input)
}

export function CsvProfileDialog({ profile, trigger, sourceFile, onSaved }: CsvProfileDialogProps) {
  const { t } = useTranslation()
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
      await invalidateCsvProfileData(queryClient)
      toast.success(i18n.t("csvProfiles.dialog.saved", { name: saved.name }))
      setOpen(false)
      onSaved?.(saved)
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
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{profile ? t("csvProfiles.dialog.editTitle") : t("csvProfiles.dialog.newTitle")}</DialogTitle>
          <DialogDescription>{t("csvProfiles.dialog.description")}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((input) => save.mutate(input))} className="space-y-6">
            <ProfileSections control={form.control} sourceFile={sourceFile} />
            <DialogFooter>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? t("csvProfiles.dialog.saving") : t("csvProfiles.dialog.save")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

function useFileColumns(control: CsvProfileControl, file: File | undefined): CsvColumnChoice[] {
  const [encoding, delimiter, hasHeader] = useWatch({ control, name: ["encoding", "delimiter", "hasHeader"] })
  const { data: bytes } = useQuery(csvSampleQuery(file))
  return bytes ? listCsvColumns(bytes, { encoding, delimiter, hasHeader }) : []
}

function ProfileSections({ control, sourceFile }: { control: CsvProfileControl; sourceFile: File | undefined }) {
  const columns = useFileColumns(control, sourceFile)

  return (
    <>
      <GeneralSection control={control} />
      <Separator />
      <ColumnsSection control={control} columns={columns} />
      <Separator />
      <AmountSection control={control} columns={columns} />
      <Separator />
      <DetectionSection control={control} />
    </>
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
  const { t } = useTranslation()
  return (
    <Section title={t("csvProfiles.sections.general")}>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField control={control} name="name" label={t("csvProfiles.general.name")} placeholder={t("csvProfiles.general.namePlaceholder")} />
        <SelectField control={control} name="accountKind" label={t("csvProfiles.general.accountKind")} options={accountKindLabels} />
        <SelectField control={control} name="encoding" label={t("csvProfiles.general.encoding")} options={csvEncodingLabels} />
        <SelectField control={control} name="delimiter" label={t("csvProfiles.general.delimiter")} options={csvDelimiterLabels} />
        <TextField
          control={control}
          name="dateFormat"
          label={t("csvProfiles.general.dateFormat")}
          placeholder="dd.MM.yyyy"
          description={t("csvProfiles.general.dateFormatHelp")}
        />
        <SelectField
          control={control}
          name="decimalSeparator"
          label={t("csvProfiles.general.decimalSeparator")}
          options={decimalSeparatorLabels}
        />
        <TextField control={control} name="defaultCurrency" label={t("csvProfiles.general.defaultCurrency")} placeholder="CHF" />
        <HasHeaderField control={control} />
      </div>
    </Section>
  )
}

function HasHeaderField({ control }: { control: CsvProfileControl }) {
  const { t } = useTranslation()
  return (
    <FormField
      control={control}
      name="hasHeader"
      render={({ field }) => (
        <FormItem className="flex items-center gap-2 self-end pb-2">
          <FormControl>
            <Checkbox checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} />
          </FormControl>
          <FormLabel>{t("csvProfiles.general.hasHeader")}</FormLabel>
        </FormItem>
      )}
    />
  )
}

type ColumnsProps = { control: CsvProfileControl; columns: CsvColumnChoice[] }

function ColumnsSection({ control, columns }: ColumnsProps) {
  const { t } = useTranslation()
  return (
    <Section title={t("csvProfiles.sections.columns")}>
      <p className="text-sm text-muted-foreground">
        {columns.length > 0
          ? t("csvProfiles.columns.fromFile")
          : t("csvProfiles.columns.manual")}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <ColumnField control={control} columns={columns} name="columns.date" label={t("csvProfiles.columns.date")} />
        <ColumnField control={control} columns={columns} name="columns.label" label={t("csvProfiles.columns.label")} />
        <ColumnField control={control} columns={columns} name="columns.valueDate" label={t("csvProfiles.columns.valueDate")} optional />
        <ColumnField control={control} columns={columns} name="columns.merchant" label={t("csvProfiles.columns.merchant")} optional />
        <ColumnField control={control} columns={columns} name="columns.account" label={t("csvProfiles.columns.account")} optional />
        <ColumnField control={control} columns={columns} name="columns.currency" label={t("csvProfiles.columns.currency")} optional />
        <ColumnField control={control} columns={columns} name="columns.balance" label={t("csvProfiles.columns.balance")} optional />
        <ColumnField control={control} columns={columns} name="columns.category" label={t("csvProfiles.columns.category")} optional />
        <ColumnField control={control} columns={columns} name="columns.status" label={t("csvProfiles.columns.status")} optional />
      </div>
    </Section>
  )
}

function AmountSection({ control, columns }: ColumnsProps) {
  const { t } = useTranslation()
  const mode = useWatch({ control, name: "amount.mode" })

  return (
    <Section title={t("csvProfiles.sections.amount")}>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField control={control} name="amount.mode" label={t("csvProfiles.amount.mode")} options={amountModeLabels} />
        <ColumnField control={control} columns={columns} name="amount.column" label={t("csvProfiles.amount.column")} />
        {mode === "debitCredit" && (
          <>
            <ColumnField control={control} columns={columns} name="amount.indicatorColumn" label={t("csvProfiles.amount.indicatorColumn")} />
            <TextField
              control={control}
              name="amount.debitValue"
              label={t("csvProfiles.amount.debitValue")}
              placeholder={t("csvProfiles.amount.debitPlaceholder")}
            />
          </>
        )}
      </div>
    </Section>
  )
}

function DetectionSection({ control }: { control: CsvProfileControl }) {
  const { t } = useTranslation()
  return (
    <>
      <Section title={t("csvProfiles.sections.detection")}>
        <FormField
          control={control}
          name="detect.requiredHeaders"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("csvProfiles.detection.requiredHeaders")}</FormLabel>
              <FormControl>
                <Textarea rows={4} placeholder={"IBAN\nBooked At"} {...field} />
              </FormControl>
              <FormDescription>{t("csvProfiles.detection.requiredHeadersHelp")}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </Section>
      <Separator />
      <Section title={t("csvProfiles.sections.statuses")}>
        <CsvProfileStatuses control={control} />
      </Section>
    </>
  )
}
