import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { accountsQuery } from "@/lib/queries"
import { cn } from "@/lib/utils"

const ALL_ACCOUNTS = "all"

type AccountSelectProps = {
  value: string | undefined
  onChange: (accountId: string | undefined) => void
  allowAll?: boolean
  placeholder?: string
  className?: string
  id?: string
}

export function AccountSelect({ value, onChange, allowAll = false, placeholder, className, id }: AccountSelectProps) {
  const { t } = useTranslation()
  const { data: accounts = [] } = useQuery(accountsQuery)
  const selected = value ?? (allowAll ? ALL_ACCOUNTS : "")

  return (
    <Select value={selected} onValueChange={(next) => onChange(next === ALL_ACCOUNTS ? undefined : next)}>
      <SelectTrigger id={id} className={cn("w-full", className)}>
        <SelectValue placeholder={placeholder ?? t("importMisc.accountSelect.placeholder")} />
      </SelectTrigger>
      <SelectContent>
        {allowAll && <SelectItem value={ALL_ACCOUNTS}>{t("importMisc.accountSelect.all")}</SelectItem>}
        {accounts.map((account) => (
          <SelectItem key={account.id} value={account.id}>
            {account.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
