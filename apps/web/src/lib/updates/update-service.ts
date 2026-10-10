import { isAndroid, isTauri } from "@/lib/runtime"
import { fetchLatestRelease } from "./github-release"
import { isNewerVersion, stripVersionPrefix } from "./version"

export const APP_VERSION = stripVersionPrefix(__APP_VERSION__)

export type UpdateChannel = "desktop" | "android" | "web"

export type ProgressListener = (ratio: number | null) => void

export type AvailableUpdate = {
  version: string
  notes: string
  install: ((onProgress: ProgressListener) => Promise<void>) | null
  downloadUrl: string | null
}

export type UpdateCheck = {
  channel: UpdateChannel
  current: string
  update: AvailableUpdate | null
}

export function updateChannel(): UpdateChannel {
  if (!isTauri()) return "web"
  return isAndroid() ? "android" : "desktop"
}

async function checkWithUpdater(): Promise<AvailableUpdate | null> {
  const { check } = await import("@tauri-apps/plugin-updater")
  const update = await check()
  if (!update) return null
  return {
    version: stripVersionPrefix(update.version),
    notes: update.body?.trim() ?? "",
    downloadUrl: null,
    install: async (onProgress) => {
      let total = 0
      let downloaded = 0
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          total = event.data.contentLength ?? 0
          onProgress(total > 0 ? 0 : null)
        }
        if (event.event === "Progress") {
          downloaded += event.data.chunkLength
          onProgress(total > 0 ? downloaded / total : null)
        }
        if (event.event === "Finished") onProgress(1)
      })
      const { relaunch } = await import("@tauri-apps/plugin-process")
      await relaunch()
    },
  }
}

async function checkWithRelease(preferApk: boolean): Promise<AvailableUpdate | null> {
  const release = await fetchLatestRelease()
  if (!isNewerVersion(release.version, APP_VERSION)) return null
  return {
    version: release.version,
    notes: release.notes,
    install: null,
    downloadUrl: (preferApk ? release.apkUrl : null) ?? release.pageUrl,
  }
}

export async function checkForUpdate(): Promise<UpdateCheck> {
  const channel = updateChannel()
  const update = channel === "desktop" ? await checkWithUpdater() : await checkWithRelease(channel === "android")
  return { channel, current: APP_VERSION, update }
}

export async function openDownloadUrl(url: string): Promise<void> {
  if (isTauri()) {
    const { openUrl } = await import("@tauri-apps/plugin-opener")
    await openUrl(url)
    return
  }
  window.open(url, "_blank", "noopener,noreferrer")
}
