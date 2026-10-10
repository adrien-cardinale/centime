import { type Db, receipts } from "@centime/db"
import { z } from "zod"
import i18n from "@/i18n"
import { authorizationOf, ensureOk, runDirectly, SyncError, type SyncConfig, send } from "./sync-client"

export const MAX_BLOB_BYTES = 8 * 1024 * 1024
export const MAX_BLOB_TRANSFERS = 20
const TRANSFER_TIMEOUT_MS = 120_000
const BLOB_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export type BlobStore = {
  listIds(): Promise<string[]>
  read(id: string): Promise<Uint8Array | null>
  write(id: string, sealed: Uint8Array): Promise<void>
  remove(id: string): Promise<void>
}

export type BlobRow = { id: string; deletedAt: string | null; sha256: string }

export type BlobPlan = { upload: string[]; download: string[]; deleteRemote: string[]; deleteLocal: string[] }

export type BlobSyncReport = {
  uploaded: number
  downloaded: number
  deleted: number
  pending: number
  error: string | null
}

type BlobOperation = { kind: "upload" | "download" | "deleteRemote"; id: string }

type BlobContext = { config: SyncConfig; store: BlobStore; rows: Map<string, BlobRow>; report: BlobSyncReport }

const listResponseSchema = z.object({ ids: z.array(z.string()) })

let inFlight: Promise<BlobSyncReport> | null = null

export function isBlobId(id: string): boolean {
  return BLOB_ID_PATTERN.test(id)
}

export function planBlobSync({ remote, local, rows }: { remote: string[]; local: string[]; rows: BlobRow[] }): BlobPlan {
  const remoteIds = new Set(remote.filter(isBlobId))
  const localIds = new Set(local.filter(isBlobId))
  const knownIds = new Set(rows.map((row) => row.id))
  const activeIds = new Set(rows.filter((row) => row.deletedAt === null && isBlobId(row.id)).map((row) => row.id))
  return {
    upload: [...localIds].filter((id) => activeIds.has(id) && !remoteIds.has(id)),
    download: [...activeIds].filter((id) => !localIds.has(id) && remoteIds.has(id)),
    deleteRemote: [...remoteIds].filter((id) => knownIds.has(id) && !activeIds.has(id)),
    deleteLocal: [...localIds].filter((id) => knownIds.has(id) && !activeIds.has(id)),
  }
}

function blobPath(id: string): string {
  return `/api/blob/${id}`
}

function transferInit(config: SyncConfig, method: string, body?: Uint8Array): RequestInit {
  const headers: Record<string, string> = { Authorization: authorizationOf(config) }
  const signal = AbortSignal.timeout(TRANSFER_TIMEOUT_MS)
  if (!body) return { method, headers, signal }
  headers["Content-Type"] = "application/octet-stream"
  return { method, headers, signal, body: body as BufferSource }
}

async function listRemoteIds(config: SyncConfig): Promise<string[]> {
  const response = await send(config, "/api/blob", transferInit(config, "GET"))
  await ensureOk(response)
  const parsed = listResponseSchema.safeParse(await response.json().catch(() => null))
  if (!parsed.success) throw new SyncError(i18n.t("syncErrors.invalidResponse"), "server")
  return parsed.data.ids
}

export async function downloadBlob(config: SyncConfig, id: string): Promise<Uint8Array | null> {
  const response = await send(config, blobPath(id), transferInit(config, "GET"))
  if (response.status === 404) return null
  await ensureOk(response)
  return new Uint8Array(await response.arrayBuffer())
}

async function uploadBlob(config: SyncConfig, id: string, sealed: Uint8Array): Promise<void> {
  await ensureOk(await send(config, blobPath(id), transferInit(config, "PUT", sealed)))
}

async function deleteRemoteBlob(config: SyncConfig, id: string): Promise<void> {
  await ensureOk(await send(config, blobPath(id), transferInit(config, "DELETE")))
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as BufferSource))
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

async function matchesFingerprint(config: SyncConfig, sealed: Uint8Array, expected: string): Promise<boolean> {
  try {
    return (await sha256Hex(await config.vault.decrypt(sealed))) === expected
  } catch {
    return false
  }
}

async function runUpload({ config, store, report }: BlobContext, id: string): Promise<void> {
  const sealed = await store.read(id)
  if (sealed === null) return
  if (sealed.byteLength > MAX_BLOB_BYTES) {
    report.error = i18n.t("syncErrors.blobTooLarge")
    return
  }
  await uploadBlob(config, id, sealed)
  report.uploaded += 1
}

async function runDownload({ config, store, rows, report }: BlobContext, id: string): Promise<void> {
  const sealed = await downloadBlob(config, id)
  if (sealed === null) return
  if (!(await matchesFingerprint(config, sealed, rows.get(id)?.sha256 ?? ""))) {
    report.error = i18n.t("syncErrors.blobCorrupted")
    return
  }
  await store.write(id, sealed)
  report.downloaded += 1
}

async function runDeleteRemote({ config, report }: BlobContext, id: string): Promise<void> {
  await deleteRemoteBlob(config, id)
  report.deleted += 1
}

function runOperation(context: BlobContext, operation: BlobOperation): Promise<void> {
  if (operation.kind === "upload") return runUpload(context, operation.id)
  if (operation.kind === "download") return runDownload(context, operation.id)
  return runDeleteRemote(context, operation.id)
}

function operationsOf(plan: BlobPlan): BlobOperation[] {
  return [
    ...plan.deleteRemote.map((id) => ({ kind: "deleteRemote" as const, id })),
    ...plan.upload.map((id) => ({ kind: "upload" as const, id })),
    ...plan.download.map((id) => ({ kind: "download" as const, id })),
  ]
}

async function removeLocalCopies(store: BlobStore, ids: string[]): Promise<void> {
  for (const id of ids) await store.remove(id)
}

async function readRows(db: Db, config: SyncConfig): Promise<BlobRow[]> {
  const exclusive = config.exclusive ?? runDirectly
  return exclusive(() =>
    db.select({ id: receipts.id, deletedAt: receipts.deletedAt, sha256: receipts.sha256 }).from(receipts),
  )
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : i18n.t("syncErrors.unexpected")
}

async function runOperations(context: BlobContext, operations: BlobOperation[]): Promise<void> {
  const batch = operations.slice(0, MAX_BLOB_TRANSFERS)
  context.report.pending = operations.length
  for (const operation of batch) {
    await runOperation(context, operation)
    context.report.pending -= 1
  }
}

async function reconcile(db: Db, config: SyncConfig, store: BlobStore): Promise<BlobSyncReport> {
  const report: BlobSyncReport = { uploaded: 0, downloaded: 0, deleted: 0, pending: 0, error: null }
  try {
    const remote = await listRemoteIds(config)
    const rows = await readRows(db, config)
    const plan = planBlobSync({ remote, local: await store.listIds(), rows })
    await removeLocalCopies(store, plan.deleteLocal)
    const context: BlobContext = { config, store, rows: new Map(rows.map((row) => [row.id, row])), report }
    await runOperations(context, operationsOf(plan))
  } catch (error) {
    report.error = messageOf(error)
  }
  return report
}

export function synchronizeBlobs(db: Db, config: SyncConfig, store: BlobStore): Promise<BlobSyncReport> {
  inFlight ??= reconcile(db, config, store).finally(() => {
    inFlight = null
  })
  return inFlight
}
