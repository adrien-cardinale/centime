import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Ban } from "lucide-react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { api, type ApiToken } from "@/lib/api"
import { formatDateTime } from "@/lib/format"
import { apiTokensQuery } from "@/lib/queries"
import { NewApiTokenDialog } from "./new-api-token-dialog"

export function ApiTokensPanel() {
  const { data: tokens, isPending, error } = useQuery(apiTokensQuery)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Les jetons d'API permettent à l'application de bureau de se synchroniser avec ce serveur.
        </p>
        <NewApiTokenDialog />
      </div>
      <Card className="py-0">
        <CardContent className="px-0">
          {isPending && <Skeleton className="m-6 h-5" />}
          {error && <p className="p-6 text-sm text-destructive">{error.message}</p>}
          {tokens && <ApiTokensTable tokens={tokens} />}
        </CardContent>
      </Card>
    </div>
  )
}

function ApiTokensTable({ tokens }: { tokens: ApiToken[] }) {
  if (tokens.length === 0) {
    return <p className="p-6 text-center text-sm text-muted-foreground">Aucun jeton d'API.</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-6">Libellé</TableHead>
          <TableHead>Créé le</TableHead>
          <TableHead>Dernière utilisation</TableHead>
          <TableHead className="pr-6 text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tokens.map((token) => (
          <TableRow key={token.id}>
            <TableCell className="pl-6 font-medium">{token.label}</TableCell>
            <TableCell>{formatDateTime(token.createdAt)}</TableCell>
            <TableCell>{token.lastUsedAt ? formatDateTime(token.lastUsedAt) : "Jamais"}</TableCell>
            <TableCell className="pr-6">
              <div className="flex justify-end">
                {token.revokedAt ? <Badge variant="secondary">Révoqué</Badge> : <RevokeTokenButton token={token} />}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function RevokeTokenButton({ token }: { token: ApiToken }) {
  const queryClient = useQueryClient()
  const revoke = useMutation({
    mutationFn: () => api.auth.revokeToken(token.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: apiTokensQuery.queryKey })
      toast.success(`Jeton « ${token.label} » révoqué`)
    },
    onError: (error) => toast.error(error.message),
  })

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" disabled={revoke.isPending}>
          <Ban />
          Révoquer
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Révoquer le jeton « {token.label} » ?</AlertDialogTitle>
          <AlertDialogDescription>
            L'appareil qui l'utilise ne pourra plus se synchroniser. Cette action est définitive.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={() => revoke.mutate()}>Révoquer</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
