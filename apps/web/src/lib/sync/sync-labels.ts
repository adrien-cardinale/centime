import { formatDistanceToNowStrict, parseISO } from "date-fns"
import i18n, { currentDateFnsLocale } from "@/i18n"
import type { SyncState } from "./sync-store"

export function formatLastSync(lastAt: string | null): string {
  if (lastAt === null) return i18n.t("syncState.neverSynced")
  const when = formatDistanceToNowStrict(parseISO(lastAt), { locale: currentDateFnsLocale(), addSuffix: true })
  return i18n.t("syncState.syncedAgo", { when })
}

export function formatPendingChanges(count: number): string {
  if (count === 0) return i18n.t("syncState.noPending")
  return i18n.t("syncState.pending", { count })
}

export function describeSyncState(state: SyncState): string {
  if (!state.configured) return i18n.t("syncState.notConfigured")
  if (state.status === "syncing") return i18n.t("syncState.syncing")
  if (state.status === "offline") {
    return i18n.t("syncState.offline", { pending: formatPendingChanges(state.dirtyCount) })
  }
  if (state.status === "error" && state.lastError) return i18n.t("syncState.error", { message: state.lastError })
  return `${formatLastSync(state.lastAt)} · ${formatPendingChanges(state.dirtyCount)}`
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} ${i18n.t("syncState.units.byte")}`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} ${i18n.t("syncState.units.kilo")}`
  return `${(bytes / (1024 * 1024)).toFixed(1)} ${i18n.t("syncState.units.mega")}`
}
