import type { QueryClient } from "@tanstack/react-query"
import { fetch as tauriFetch } from "@tauri-apps/plugin-http"
import { useSyncExternalStore } from "react"
import i18n from "@/i18n"
import { getVault } from "@/lib/crypto/current-vault"
import { getLocalDatabase } from "@/lib/local-db/current-database"
import { countPendingChanges, markAllChangesPending } from "@/lib/local-db/local-data"
import { onMutationSettled } from "@/lib/queries"
import {
  deleteReceiptImage,
  listReceiptImageIds,
  readSealedReceiptImage,
  writeSealedReceiptImage,
} from "@/lib/receipts/receipt-store"
import { isStaticBuild, isTauri } from "@/lib/runtime"
import { type BlobStore, downloadBlob, isBlobId, synchronizeBlobs } from "./blob-sync"
import {
  deleteAccount,
  type FetchLike,
  normalizeServerUrl,
  type SyncConfig,
  SyncError,
  type SyncReport,
  synchronize,
} from "./sync-client"
import { clearSyncSetting, readSyncSettings, writeSyncSetting } from "./sync-settings"

const SYNC_INTERVAL_MS = 5 * 60 * 1000
const MUTATION_DELAY_MS = 5 * 1000

export type SyncStatus = "idle" | "syncing" | "error" | "offline"

export type SyncState = {
  status: SyncStatus
  configured: boolean
  serverUrl: string | null
  lastAt: string | null
  lastError: string | null
  dirtyCount: number
  blobsPending: number
  lastBlobError: string | null
}

export type SyncOutcome = { ok: true; report: SyncReport } | { ok: false; message: string }

const fetchFromRuntime: FetchLike = (url, init) => (isTauri() ? tauriFetch(url, init) : fetch(url, init))

let state: SyncState = {
  status: "idle",
  configured: false,
  serverUrl: null,
  lastAt: null,
  lastError: null,
  dirtyCount: 0,
  blobsPending: 0,
  lastBlobError: null,
}
const listeners = new Set<() => void>()
let running: Promise<SyncOutcome> | null = null
let queryClient: QueryClient | null = null
let mutationTimer: ReturnType<typeof setTimeout> | null = null
let started = false
const unavailableImageIds = new Set<string>()

const receiptBlobStore: BlobStore = {
  listIds: listReceiptImageIds,
  read: readSealedReceiptImage,
  write: writeSealedReceiptImage,
  remove: deleteReceiptImage,
}

function setState(changes: Partial<SyncState>): void {
  state = { ...state, ...changes }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getSyncState(): SyncState {
  return state
}

export function useSyncStore(): SyncState {
  return useSyncExternalStore(subscribe, getSyncState)
}

export async function refreshSyncState(): Promise<void> {
  const database = getLocalDatabase()
  const { settings, dirtyCount } = await database.run(async (db) => ({
    settings: await readSyncSettings(db),
    dirtyCount: await countPendingChanges(db),
  }))
  setState({
    configured: settings.serverUrl !== null,
    serverUrl: settings.serverUrl,
    lastAt: settings.lastAt,
    lastError: settings.lastError,
    dirtyCount,
  })
}

function statusAfter(error: unknown): SyncStatus {
  return error instanceof SyncError && error.kind === "network" ? "offline" : "error"
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : i18n.t("syncErrors.unexpected")
}

function syncConfigFor(serverUrl: string): SyncConfig {
  const database = getLocalDatabase()
  return {
    serverUrl,
    vault: getVault(),
    fetch: fetchFromRuntime,
    exclusive: (task) => database.run(() => task()),
  }
}

async function synchronizeReceiptImages(config: SyncConfig): Promise<void> {
  const report = await synchronizeBlobs(getLocalDatabase().db, config, receiptBlobStore)
  setState({ blobsPending: report.pending, lastBlobError: report.error })
}

async function runSynchronization(): Promise<SyncOutcome> {
  const database = getLocalDatabase()
  const { serverUrl } = await database.run(readSyncSettings)
  if (serverUrl === null) return { ok: false, message: i18n.t("syncState.notConfigured") }
  setState({ status: "syncing" })
  try {
    const config = syncConfigFor(serverUrl)
    const report = await synchronize(database.db, config)
    await synchronizeReceiptImages(config)
    await queryClient?.invalidateQueries()
    setState({ status: "idle" })
    return { ok: true, report }
  } catch (error) {
    setState({ status: statusAfter(error) })
    return { ok: false, message: messageOf(error) }
  } finally {
    await refreshSyncState().catch(() => undefined)
  }
}

async function fetchReceiptImage(serverUrl: string, id: string): Promise<boolean> {
  const sealed = await downloadBlob(syncConfigFor(serverUrl), id)
  if (sealed === null) return false
  await writeSealedReceiptImage(id, sealed)
  return true
}

export async function fetchMissingReceiptImage(id: string): Promise<boolean> {
  const { serverUrl } = state
  if (serverUrl === null || !isBlobId(id) || unavailableImageIds.has(id)) return false
  unavailableImageIds.add(id)
  try {
    const fetched = await fetchReceiptImage(serverUrl, id)
    if (fetched) unavailableImageIds.delete(id)
    return fetched
  } catch (error) {
    console.error("Téléchargement de l'image du ticket impossible", error)
    return false
  }
}

export function syncNow(): Promise<SyncOutcome> {
  running ??= runSynchronization().finally(() => {
    running = null
  })
  return running
}

export async function setServerUrl(serverUrl: string): Promise<void> {
  await getLocalDatabase().run(async (db) => {
    await writeSyncSetting(db, "serverUrl", normalizeServerUrl(serverUrl))
    await writeSyncSetting(db, "cursor", 0)
    await markAllChangesPending(db)
    await clearSyncSetting(db, "lastError")
  })
  await refreshSyncState()
}

export async function configure(serverUrl: string): Promise<SyncOutcome> {
  await setServerUrl(serverUrl)
  return syncNow()
}

export async function disconnect(): Promise<void> {
  await getLocalDatabase().run((db) => clearSyncSetting(db, "serverUrl", "lastError"))
  setState({ status: "idle" })
  await refreshSyncState()
}

export async function deleteServerAccount(): Promise<void> {
  const { serverUrl } = await getLocalDatabase().run(readSyncSettings)
  if (serverUrl === null) throw new Error(i18n.t("syncState.notConfigured"))
  await deleteAccount({ serverUrl, vault: getVault(), fetch: fetchFromRuntime })
}

function scheduleAfterMutation(): void {
  void refreshSyncState().catch(() => undefined)
  if (mutationTimer !== null) clearTimeout(mutationTimer)
  mutationTimer = setTimeout(() => {
    mutationTimer = null
    if (state.configured) void syncNow()
  }, MUTATION_DELAY_MS)
}

function servedByRelay(): boolean {
  return !isTauri() && !isStaticBuild()
}

export function startSyncScheduler(client: QueryClient): void {
  queryClient = client
  if (started) return
  started = true
  onMutationSettled(scheduleAfterMutation)
  setInterval(() => {
    if (state.configured) void syncNow()
  }, SYNC_INTERVAL_MS)
  void refreshSyncState()
    .then(async () => {
      if (!state.configured && servedByRelay()) await configure(window.location.origin)
      else if (state.configured) await syncNow()
    })
    .catch(() => undefined)
}
