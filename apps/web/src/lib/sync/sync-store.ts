import type { QueryClient } from "@tanstack/react-query"
import { fetch as tauriFetch } from "@tauri-apps/plugin-http"
import { useSyncExternalStore } from "react"
import { getLocalDatabase } from "@/lib/local-db/current-database"
import { countPendingChanges } from "@/lib/local-db/local-data"
import { onMutationSettled } from "@/lib/queries"
import { type FetchLike, normalizeServerUrl, SyncError, type SyncReport, synchronize } from "./sync-client"
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
}

export type SyncOutcome = { ok: true; report: SyncReport } | { ok: false; message: string }

export type ConnectInput = { serverUrl: string; password: string; label: string }

const fetchFromDesktop: FetchLike = (url, init) => tauriFetch(url, init)

let state: SyncState = {
  status: "idle",
  configured: false,
  serverUrl: null,
  lastAt: null,
  lastError: null,
  dirtyCount: 0,
}
const listeners = new Set<() => void>()
let running: Promise<SyncOutcome> | null = null
let queryClient: QueryClient | null = null
let mutationTimer: ReturnType<typeof setTimeout> | null = null
let started = false

function setState(changes: Partial<SyncState>): void {
  state = { ...state, ...changes }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): SyncState {
  return state
}

export function useSyncStore(): SyncState {
  return useSyncExternalStore(subscribe, getSnapshot)
}

export async function refreshSyncState(): Promise<void> {
  const database = getLocalDatabase()
  const { settings, dirtyCount } = await database.run(async (db) => ({
    settings: await readSyncSettings(db),
    dirtyCount: await countPendingChanges(db),
  }))
  setState({
    configured: settings.serverUrl !== null && settings.token !== null,
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
  return error instanceof Error ? error.message : "Erreur de synchronisation inattendue"
}

async function runSynchronization(): Promise<SyncOutcome> {
  const database = getLocalDatabase()
  const { serverUrl, token } = await database.run(readSyncSettings)
  if (serverUrl === null || token === null) return { ok: false, message: "Synchronisation non configurée" }
  setState({ status: "syncing" })
  try {
    const report = await synchronize(database.db, {
      serverUrl,
      token,
      fetch: fetchFromDesktop,
      exclusive: (task) => database.run(() => task()),
    })
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

export function syncNow(): Promise<SyncOutcome> {
  running ??= runSynchronization().finally(() => {
    running = null
  })
  return running
}

async function requestToken(input: ConnectInput): Promise<string> {
  const serverUrl = normalizeServerUrl(input.serverUrl)
  let response: Response
  try {
    response = await fetchFromDesktop(`${serverUrl}/api/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: input.password, label: input.label }),
    })
  } catch {
    throw new Error("Serveur injoignable : vérifie l'adresse et la connexion réseau")
  }
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) throw new Error(errorOf(body) ?? `Erreur du serveur (${response.status})`)
  if (!body || typeof body !== "object" || !("token" in body) || typeof body.token !== "string") {
    throw new Error("Réponse du serveur invalide")
  }
  return body.token
}

function errorOf(body: unknown): string | null {
  if (body && typeof body === "object" && "error" in body && typeof body.error === "string") return body.error
  return null
}

export async function configure(input: ConnectInput): Promise<SyncOutcome> {
  const token = await requestToken(input)
  await getLocalDatabase().run(async (db) => {
    await writeSyncSetting(db, "serverUrl", normalizeServerUrl(input.serverUrl))
    await writeSyncSetting(db, "token", token)
    await writeSyncSetting(db, "cursor", 0)
    await clearSyncSetting(db, "lastError")
  })
  await refreshSyncState()
  return syncNow()
}

export async function disconnect(): Promise<void> {
  await getLocalDatabase().run((db) => clearSyncSetting(db, "serverUrl", "token", "lastError"))
  setState({ status: "idle" })
  await refreshSyncState()
}

function scheduleAfterMutation(): void {
  void refreshSyncState().catch(() => undefined)
  if (mutationTimer !== null) clearTimeout(mutationTimer)
  mutationTimer = setTimeout(() => {
    mutationTimer = null
    if (state.configured) void syncNow()
  }, MUTATION_DELAY_MS)
}

export function startSyncScheduler(client: QueryClient): void {
  queryClient = client
  if (started) return
  started = true
  onMutationSettled(scheduleAfterMutation)
  setInterval(() => {
    if (state.configured) void syncNow()
  }, SYNC_INTERVAL_MS)
  void refreshSyncState().then(() => {
    if (state.configured) void syncNow()
  })
}
