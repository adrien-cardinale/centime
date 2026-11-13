import { useId } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useBaseCurrencySetting, useSaveBaseCurrency } from "@/lib/base-currency"

export function BaseCurrencyCard() {
  const { t } = useTranslation()
  const { data } = useBaseCurrencySetting()
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.baseCurrency.title")}</CardTitle>
        <CardDescription>{t("settings.baseCurrency.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {data ? (
          <BaseCurrencySelect currency={data.currency} options={data.options} />
        ) : (
          <Skeleton className="h-9 w-48" />
        )}
      </CardContent>
    </Card>
  )
}

function BaseCurrencySelect({ currency, options }: { currency: string; options: string[] }) {
  const { t } = useTranslation()
  const id = useId()
  const save = useSaveBaseCurrency()

  const change = (next: string) =>
    save.mutate(next, { onError: () => toast.error(t("settings.baseCurrency.saveFailed")) })

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{t("settings.baseCurrency.label")}</Label>
      <Select value={currency} disabled={save.isPending} onValueChange={change}>
        <SelectTrigger id={id} className="w-full sm:w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
