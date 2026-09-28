import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { TriangleAlert, Upload } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { api, type ImportOutcome, type ImportPreview } from "@/lib/api"
import { accountsQuery, importPreviewQuery, invalidateAfterImport } from "@/lib/queries"
import { ImportOptions } from "./import-options"
import { ImportSummary } from "./import-summary"
import { PreviewTable } from "./preview-table"
import { RowErrorsAlert } from "./row-errors-alert"

type ImportWorkspaceProps = {
  file: File
  onImported: () => void
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count > 1 ? pluralForm : singular}`
}

function describeOutcome(outcome: ImportOutcome): string {
  const parts = [plural(outcome.inserted, "transaction importée", "transactions importées")]
  if (outcome.updated > 0) parts.push(plural(outcome.updated, "mise à jour", "mises à jour"))
  if (outcome.skipped > 0) parts.push(plural(outcome.skipped, "doublon ignoré", "doublons ignorés"))
  if (outcome.accountsCreated > 0) parts.push(plural(outcome.accountsCreated, "compte créé", "comptes créés"))
  return parts.join(", ")
}

function canImport(preview: ImportPreview, accountId: string | undefined): boolean {
  const hasChanges = preview.summary.new > 0 || preview.summary.pendingToBooked > 0
  const hasProfile = preview.format !== "csv" || preview.profile !== null
  const hasAccount = preview.accountResolution === "auto" || accountId !== undefined
  return hasChanges && hasProfile && hasAccount
}

export function ImportWorkspace({ file, onImported }: ImportWorkspaceProps) {
  const queryClient = useQueryClient()
  const [profileId, setProfileId] = useState<string>()
  const [accountId, setAccountId] = useState<string>()
  const upload = { file, profileId, accountId }
  const preview = useQuery(importPreviewQuery(upload))
  const { data: accounts = [] } = useQuery(accountsQuery)
  const fallbackAccountName = accounts.find((account) => account.id === accountId)?.name ?? null

  const commit = useMutation({
    mutationFn: api.imports.commit,
    onSuccess: async (outcome) => {
      toast.success(describeOutcome(outcome))
      onImported()
      await invalidateAfterImport(queryClient)
    },
    onError: (error) => toast.error(error.message),
  })

  if (preview.isPending) return <WorkspaceSkeleton />
  if (preview.error) return <PreviewErrorAlert message={preview.error.message} />

  const data = preview.data
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-6">
          <ImportOptions
            preview={data}
            profileId={profileId}
            accountId={accountId}
            onProfileChange={setProfileId}
            onAccountChange={setAccountId}
          />
          <div className="flex justify-end">
            <Button onClick={() => commit.mutate(upload)} disabled={!canImport(data, accountId) || commit.isPending}>
              <Upload />
              {commit.isPending ? "Import…" : "Importer"}
            </Button>
          </div>
        </CardContent>
      </Card>
      <ImportSummary summary={data.summary} />
      <RowErrorsAlert errors={data.errors} total={data.summary.errors} />
      <Card className="gap-0 pb-0">
        <CardHeader className="pb-4">
          <CardTitle>Aperçu</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <PreviewTable rows={data.rows} total={data.summary.total} fallbackAccountName={fallbackAccountName} />
        </CardContent>
      </Card>
    </div>
  )
}

function PreviewErrorAlert({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
      <TriangleAlert />
      <AlertTitle>Lecture du fichier impossible</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}

function WorkspaceSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}
