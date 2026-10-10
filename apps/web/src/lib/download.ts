import { downloadDir, join } from "@tauri-apps/api/path"
import { mkdir, writeFile } from "@tauri-apps/plugin-fs"
import { toast } from "sonner"
import i18n from "@/i18n"
import { isAndroid } from "@/lib/runtime"

export async function downloadBlob(blob: Blob, fileName: string): Promise<void> {
  if (isAndroid()) {
    await saveToDownloadDir(blob, fileName)
    return
  }
  triggerBrowserDownload(blob, fileName)
}

function triggerBrowserDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

async function saveToDownloadDir(blob: Blob, fileName: string): Promise<void> {
  try {
    const directory = await downloadDir()
    const filePath = await join(directory, fileName)
    await mkdir(directory, { recursive: true })
    await writeFile(filePath, new Uint8Array(await blob.arrayBuffer()))
    toast.success(i18n.t("common.fileSaved"), { description: filePath })
  } catch (error) {
    toast.error(i18n.t("common.fileSaveFailed"), {
      description: error instanceof Error ? error.message : String(error),
    })
  }
}
