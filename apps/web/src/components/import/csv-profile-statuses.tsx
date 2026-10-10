import { TRANSACTION_STATUSES } from "@centime/core"
import { Plus, Trash2 } from "lucide-react"
import { useFieldArray } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { FormControl, FormField, FormItem } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { transactionStatusLabels } from "@/lib/labels"
import type { CsvProfileControl } from "./csv-profile-fields"

export function CsvProfileStatuses({ control }: { control: CsvProfileControl }) {
  const { t } = useTranslation()
  const { fields, append, remove } = useFieldArray({ control, name: "statuses" })

  return (
    <div className="space-y-3">
      {fields.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("csvProfiles.statuses.empty")}</p>
      )}
      {fields.map((entry, index) => (
        <div key={entry.id} className="grid grid-cols-[1fr_auto] items-start gap-2 sm:flex">
          <FormField
            control={control}
            name={`statuses.${index}.value`}
            render={({ field }) => (
              <FormItem className="min-w-0 sm:flex-1">
                <FormControl>
                  <Input placeholder={t("csvProfiles.statuses.value")} aria-label={t("csvProfiles.statuses.value")} {...field} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={`statuses.${index}.status`}
            render={({ field }) => (
              <FormItem className="col-span-2 row-start-2 w-full sm:w-44">
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full" aria-label={t("csvProfiles.statuses.status")}>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {TRANSACTION_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {transactionStatusLabels[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
          <Button type="button" variant="ghost" size="icon" aria-label={t("csvProfiles.statuses.remove")} onClick={() => remove(index)}>
            <Trash2 />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => append({ value: "", status: "booked" })}>
        <Plus />
        {t("csvProfiles.statuses.add")}
      </Button>
    </div>
  )
}
