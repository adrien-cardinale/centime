import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { DeviceAccount } from "@/lib/account/account-index"
import { deviceAccountsQuery } from "@/lib/account/accounts-query"
import { RenameAccountDialog } from "./rename-account-dialog"
import { switchToAccount } from "./switch-to-account"

function UseAccountButton({ id }: { id: string }) {
  const { t } = useTranslation()
  const [pending, setPending] = useState(false)

  const use = async () => {
    setPending(true)
    await switchToAccount(id)
    setPending(false)
  }

  return (
    <Button variant="outline" size="sm" onClick={() => void use()} disabled={pending}>
      {t("settings.account.use")}
    </Button>
  )
}

function DeviceAccountRow({ account, isActive }: { account: DeviceAccount; isActive: boolean }) {
  const { t } = useTranslation()
  return (
    <li className="flex items-center gap-2 px-3 py-2">
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{account.label}</span>
      {isActive ? <Badge variant="secondary">{t("settings.account.active")}</Badge> : <UseAccountButton id={account.id} />}
      <RenameAccountDialog account={account} />
    </li>
  )
}

export function DeviceAccountList() {
  const { data: index } = useQuery(deviceAccountsQuery)
  if (!index) return null

  return (
    <ul className="divide-y rounded-md border">
      {index.accounts.map((account) => (
        <DeviceAccountRow key={account.id} account={account} isActive={account.id === index.activeId} />
      ))}
    </ul>
  )
}
