import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
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
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import i18n from "@/i18n"
import { api, type ImportHistoryEntry } from "@/lib/api"
import { formatDateTime } from "@/lib/format"
import { importFormatLabels } from "@/lib/labels"
import { importsQuery, invalidateAfterImport } from "@/lib/queries"

export function ImportHistory() {
  const { t } = useTranslation()
  const { data: entries, isPending, error } = useQuery(importsQuery)

  return (
    <Card className="gap-0 pb-0">
      <CardHeader className="pb-4">
        <CardTitle>{t("importHistory.title")}</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        {isPending && <Skeleton className="mx-6 mb-6 h-5" />}
        {error && <p className="p-6 text-sm text-destructive">{error.message}</p>}
        {entries && <ImportHistoryTable entries={entries} />}
      </CardContent>
    </Card>
  )
}

function formatLabel(entry: ImportHistoryEntry): string {
  const format = importFormatLabels[entry.format]
  return entry.profileName ? `${format} · ${entry.profileName}` : format
}

function ImportHistoryTable({ entries }: { entries: ImportHistoryEntry[] }) {
  const { t } = useTranslation()
  if (entries.length === 0) {
    return <p className="border-t p-6 text-center text-sm text-muted-foreground">{t("importHistory.empty")}</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-6">{t("importHistory.columns.file")}</TableHead>
          <TableHead>{t("importHistory.columns.format")}</TableHead>
          <TableHead>{t("importHistory.columns.date")}</TableHead>
          <TableHead className="text-right">{t("importHistory.columns.inserted")}</TableHead>
          <TableHead className="text-right">{t("importHistory.columns.updated")}</TableHead>
          <TableHead className="text-right">{t("importHistory.columns.skipped")}</TableHead>
          <TableHead className="pr-6 text-right">{t("importHistory.columns.actions")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.id}>
            <TableCell className="max-w-72 truncate pl-6 font-medium" title={entry.fileName}>
              {entry.fileName}
            </TableCell>
            <TableCell>{formatLabel(entry)}</TableCell>
            <TableCell className="tabular-nums">{formatDateTime(entry.importedAt)}</TableCell>
            <TableCell className="text-right tabular-nums">{entry.insertedCount}</TableCell>
            <TableCell className="text-right tabular-nums">{entry.updatedCount}</TableCell>
            <TableCell className="text-right tabular-nums">{entry.skippedCount}</TableCell>
            <TableCell className="pr-6 text-right">
              <DeleteImportButton entry={entry} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function DeleteImportButton({ entry }: { entry: ImportHistoryEntry }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const remove = useMutation({
    mutationFn: () => api.imports.remove(entry.id),
    onSuccess: async (result) => {
      await invalidateAfterImport(queryClient)
      toast.success(
        t("importHistory.deleted", {
          name: entry.fileName,
          details: t("importHistory.deletedTransactions", { count: result.deletedTransactions }),
        }),
      )
    },
    onError: (error) => toast.error(error.message),
  })

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("importHistory.deleteAria", { name: entry.fileName })} disabled={remove.isPending}>
          <Trash2 />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("importHistory.deleteTitle", { name: entry.fileName })}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("importHistory.deleteDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={() => remove.mutate()}>{t("importHistory.delete")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
