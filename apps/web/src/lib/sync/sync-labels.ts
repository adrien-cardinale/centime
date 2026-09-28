import { formatDistanceToNowStrict, parseISO } from "date-fns"
import { fr } from "date-fns/locale"
import type { SyncState } from "./sync-store"

export function formatLastSync(lastAt: string | null): string {
  if (lastAt === null) return "Jamais synchronisé"
  return `Synchronisé ${formatDistanceToNowStrict(parseISO(lastAt), { locale: fr, addSuffix: true })}`
}

export function formatPendingChanges(count: number): string {
  if (count === 0) return "Aucune modification en attente"
  return count === 1 ? "1 modification en attente" : `${count} modifications en attente`
}

export function describeSyncState(state: SyncState): string {
  if (!state.configured) return "Synchronisation non configurée"
  if (state.status === "syncing") return "Synchronisation en cours…"
  if (state.status === "offline") return `Serveur injoignable · ${formatPendingChanges(state.dirtyCount)}`
  if (state.status === "error" && state.lastError) return `Erreur : ${state.lastError}`
  return `${formatLastSync(state.lastAt)} · ${formatPendingChanges(state.dirtyCount)}`
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}
