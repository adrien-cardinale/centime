import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { CreateAccountDialog } from "@/components/accounts/create-account-dialog"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { Account } from "@/lib/api"
import { accountKindLabels } from "@/lib/labels"
import { accountsQuery } from "@/lib/queries"
import { useTranslation } from "react-i18next"

export const Route = createFileRoute("/_app/accounts")({
  loader: ({ context }) => context.queryClient.prefetchQuery(accountsQuery),
  component: AccountsPage,
})

function AccountsPage() {
  const { t } = useTranslation()
  const { data: accounts, isPending, error } = useQuery(accountsQuery)

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("accountsPage.title")}
        description={t("accountsPage.description")}
        actions={<CreateAccountDialog />}
      />
      <Card className="py-0">
        <CardContent className="px-0">
          {isPending && <AccountsSkeleton />}
          {error && <p className="p-6 text-sm text-destructive">{error.message}</p>}
          {accounts && <AccountsTable accounts={accounts} />}
        </CardContent>
      </Card>
    </div>
  )
}

function AccountsTable({ accounts }: { accounts: Account[] }) {
  const { t } = useTranslation()
  if (accounts.length === 0) {
    return <p className="p-6 text-center text-sm text-muted-foreground">{t("accountsPage.empty")}</p>
  }

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

function AccountsSkeleton() {
  return (
    <div className="space-y-3 p-6">
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-5 w-2/3" />
    </div>
  )
}
