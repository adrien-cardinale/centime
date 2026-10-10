import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useIsMobile } from "@/hooks/use-mobile"
import type { Account } from "@/lib/api"
import { accountKindLabels } from "@/lib/labels"

export function AccountsTable({ accounts }: { accounts: Account[] }) {
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  if (accounts.length === 0) {
    return <p className="p-6 text-center text-sm text-muted-foreground">{t("accountsPage.empty")}</p>
  }
  return isMobile ? <AccountList accounts={accounts} /> : <DesktopAccountsTable accounts={accounts} />
}

function AccountList({ accounts }: { accounts: Account[] }) {
  return (
    <ul className="divide-y">
      {accounts.map((account) => (
        <li key={account.id} className="space-y-1 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate font-medium">{account.name}</span>
            <Badge variant="secondary">{accountKindLabels[account.kind]}</Badge>
          </div>
          <div className="flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
            <span className="min-w-0 font-mono break-all">{account.identifier}</span>
            <span className="shrink-0">{account.currency}</span>
          </div>
        </li>
      ))}
    </ul>
  )
}

function DesktopAccountsTable({ accounts }: { accounts: Account[] }) {
  const { t } = useTranslation()
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-6">{t("accountsPage.columns.name")}</TableHead>
          <TableHead>{t("accountsPage.columns.type")}</TableHead>
          <TableHead>{t("accountsPage.columns.identifier")}</TableHead>
          <TableHead className="pr-6 text-right">{t("accountsPage.columns.currency")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {accounts.map((account) => (
          <TableRow key={account.id}>
            <TableCell className="pl-6 font-medium">{account.name}</TableCell>
            <TableCell>
              <Badge variant="secondary">{accountKindLabels[account.kind]}</Badge>
            </TableCell>
            <TableCell className="font-mono text-xs">{account.identifier}</TableCell>
            <TableCell className="pr-6 text-right">{account.currency}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
