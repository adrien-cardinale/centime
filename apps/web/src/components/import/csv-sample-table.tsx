import type { CsvColumnChoice } from "@centime/core"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export function CsvSampleTable({ columns }: { columns: CsvColumnChoice[] }) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column.name} className="max-w-48 truncate">
                {column.name}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            {columns.map((column) => (
              <TableCell key={column.name} className="max-w-48 truncate text-muted-foreground">
                {column.sample ?? "—"}
              </TableCell>
            ))}
          </TableRow>
        </TableBody>
      </Table>
    </div>
  )
}
