import { format } from "date-fns"
import { Download } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { api, type TransactionFilters } from "@/lib/api"
import { downloadBlob } from "@/lib/download"

type ExportButtonProps = {
  filters: TransactionFilters
  disabled: boolean
}

function exportFileName(): string {
  return `transactions-${format(new Date(), "yyyy-MM-dd")}.csv`
}

export function ExportButton({ filters, disabled }: ExportButtonProps) {
  const [exporting, setExporting] = useState(false)

  const exportTransactions = async () => {
    setExporting(true)
    try {
      downloadBlob(await api.transactions.export(filters), exportFileName())
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export impossible")
    } finally {
      setExporting(false)
    }
  }

  return (
    <Button variant="outline" disabled={disabled || exporting} onClick={() => void exportTransactions()}>
      <Download />
      {exporting ? "Export…" : "Exporter"}
    </Button>
  )
}
