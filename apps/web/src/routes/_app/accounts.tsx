import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { AccountsTable } from "@/components/accounts/accounts-table"
import { CreateAccountDialog } from "@/components/accounts/create-account-dialog"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
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

function AccountsSkeleton() {
  return (
    <div className="space-y-3 p-6">
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-5 w-2/3" />
    </div>
  )
}
