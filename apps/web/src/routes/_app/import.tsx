import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { CsvProfilesPanel } from "@/components/import/csv-profiles-panel"
import { FileDropzone } from "@/components/import/file-dropzone"
import { ImportHistory } from "@/components/import/import-history"
import { ImportWorkspace } from "@/components/import/import-workspace"
import { PageHeader } from "@/components/page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import i18n from "@/i18n"
import { accountsQuery, csvProfilesQuery, importsQuery } from "@/lib/queries"

const MAX_FILE_BYTES = 10 * 1024 * 1024
const SUPPORTED_EXTENSION = /\.(csv|xml)$/i

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
  const { t } = useTranslation()
  const [selected, setSelected] = useState<SelectedFile | null>(null)

  const selectFile = (file: File) => {
    if (!SUPPORTED_EXTENSION.test(file.name)) {
      toast.error(i18n.t("importPage.unsupportedFile"))
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      toast.error(i18n.t("importPage.fileTooLarge"))
      return
    }
    setSelected({ file, key: Date.now() })
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("importPage.title")} description={t("importPage.description")} />
      <Tabs defaultValue="import">
        <TabsList>
          <TabsTrigger value="import">{t("importPage.tabImport")}</TabsTrigger>
          <TabsTrigger value="csv-profiles">{t("importPage.tabProfiles")}</TabsTrigger>
        </TabsList>
        <TabsContent value="import" forceMount className="space-y-6 pt-4 data-[state=inactive]:hidden">
          <FileDropzone file={selected?.file ?? null} onFileSelected={selectFile} />
          {selected && <ImportWorkspace key={selected.key} file={selected.file} onImported={() => setSelected(null)} />}
          <ImportHistory />
        </TabsContent>
        <TabsContent value="csv-profiles" className="pt-4">
          <CsvProfilesPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}
