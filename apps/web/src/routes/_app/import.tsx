import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"
import { FileDropzone } from "@/components/import/file-dropzone"
import { ImportHistory } from "@/components/import/import-history"
import { ImportWorkspace } from "@/components/import/import-workspace"
import { PageHeader } from "@/components/page-header"
import { accountsQuery, csvProfilesQuery, importsQuery } from "@/lib/queries"

const MAX_FILE_BYTES = 10 * 1024 * 1024

export const Route = createFileRoute("/_app/import")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.prefetchQuery(importsQuery),
      context.queryClient.prefetchQuery(csvProfilesQuery),
      context.queryClient.prefetchQuery(accountsQuery),
    ]),
  component: ImportPage,
})

type SelectedFile = { file: File; key: number }

function ImportPage() {
  const [selected, setSelected] = useState<SelectedFile | null>(null)

  const selectFile = (file: File) => {
    if (file.size > MAX_FILE_BYTES) {
      toast.error("Fichier trop volumineux (10 Mo maximum)")
      return
    }
    setSelected({ file, key: Date.now() })
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Import" description="Importez un relevé CSV ou camt.053 et vérifiez l'aperçu avant de valider." />
      <FileDropzone file={selected?.file ?? null} onFileSelected={selectFile} />
      {selected && <ImportWorkspace key={selected.key} file={selected.file} onImported={() => setSelected(null)} />}
      <ImportHistory />
    </div>
  )
}
