import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { ImportHistoryEntry } from "@/lib/api"
import { formatDateTime } from "@/lib/format"
import { importFormatLabels } from "@/lib/labels"
import { importsQuery } from "@/lib/queries"

export function ImportHistory() {
  const { data: entries, isPending, error } = useQuery(importsQuery)

  return (
    <Card className="gap-0 pb-0">
      <CardHeader className="pb-4">
        <CardTitle>Historique des imports</CardTitle>
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
  if (entries.length === 0) {
    return <p className="border-t p-6 text-center text-sm text-muted-foreground">Aucun import pour l'instant.</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-6">Fichier</TableHead>
          <TableHead>Format</TableHead>
          <TableHead>Date</TableHead>
          <TableHead className="text-right">Insérées</TableHead>
          <TableHead className="text-right">Mises à jour</TableHead>
          <TableHead className="pr-6 text-right">Ignorées</TableHead>
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
            <TableCell className="pr-6 text-right tabular-nums">{entry.skippedCount}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
