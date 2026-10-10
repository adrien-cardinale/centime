import { accounts, createProxyDb, type Db, receipts, runMigrations } from "@centime/db"
import { eq } from "@centime/db/orm"
import initSqlJs from "sql.js"
import { beforeEach, describe, expect, it } from "bun:test"
import { deriveVault, type Vault } from "../crypto/envelope"
import { generateMasterKey } from "../crypto/master-key"
import { applyConnectionPragmas, createSqlJsExecutor } from "../local-db/sqljs-executor"
import { type BlobRow, type BlobStore, MAX_BLOB_BYTES, MAX_BLOB_TRANSFERS, planBlobSync, synchronizeBlobs } from "./blob-sync"
import type { FetchLike, SyncConfig } from "./sync-client"

const SERVER_URL = "https://centime.test"
const ID_A = "00000000-0000-4000-8000-00000000000a"
const ID_B = "00000000-0000-4000-8000-00000000000b"
const ID_C = "00000000-0000-4000-8000-00000000000c"

type BlobRelay = { fetch: FetchLike; blobs: Map<string, Uint8Array>; requests: string[] }
type MemoryStore = BlobStore & { blobs: Map<string, Uint8Array> }

function row(id: string, deletedAt: string | null = null): BlobRow {
  return { id, deletedAt, sha256: "a".repeat(64) }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
}

function fakeBlobRelay(vault: Vault): BlobRelay {
  const blobs = new Map<string, Uint8Array>()
  const requests: string[] = []
  const { userId, secret } = vault.credentials
  const relayFetch: FetchLike = async (url, init) => {
    const headers = init.headers as Record<string, string>
    if (headers.Authorization !== `Bearer ${userId}.${secret}`) return json({ error: "Accès refusé" }, 401)
    const { pathname } = new URL(url)
    requests.push(`${init.method} ${pathname}`)
    if (pathname === "/api/blob") return json({ ids: [...blobs.keys()] })
    const id = pathname.slice("/api/blob/".length)
    if (init.method === "PUT") {
      blobs.set(id, new Uint8Array(init.body as Uint8Array))
      return new Response(null, { status: 201 })
    }
    if (init.method === "DELETE") {
      blobs.delete(id)
      return new Response(null, { status: 204 })
    }
    const data = blobs.get(id)
    return data ? new Response(data as BodyInit, { status: 200 }) : json({ error: "Fichier introuvable" }, 404)
  }
  return { fetch: relayFetch, blobs, requests }
}

function memoryStore(): MemoryStore {
  const blobs = new Map<string, Uint8Array>()
  return {
    blobs,
    listIds: async () => [...blobs.keys()],
    read: async (id) => blobs.get(id) ?? null,
    write: async (id, sealed) => {
      blobs.set(id, sealed)
    },
    remove: async (id) => {
      blobs.delete(id)
    },
  }
}

async function createLocalDb(): Promise<Db> {
  const SQL = await initSqlJs()
  const database = new SQL.Database()
  applyConnectionPragmas(database)
  const db = createProxyDb(createSqlJsExecutor(database))
  await runMigrations(db)
  return db
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as BufferSource))
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

async function insertReceipt(db: Db, id: string, image: Uint8Array): Promise<void> {
  const [account] = await db
    .insert(accounts)
    .values({ name: "Compte", kind: "bank", identifier: `CH-${id}` })
    .returning({ id: accounts.id })
  if (!account) throw new Error("Compte non créé")
  await db.insert(receipts).values({
    id,
    accountId: account.id,
    capturedAt: "2026-01-15T10:00:00.000Z",
    mime: "image/jpeg",
    size: image.byteLength,
    sha256: await sha256Hex(image),
    status: "pending",
  })
}

describe("planBlobSync", () => {
  it("uploads local images of active receipts missing on the relay", () => {
    const plan = planBlobSync({ remote: [ID_B], local: [ID_A, ID_B], rows: [row(ID_A), row(ID_B)] })
    expect(plan.upload).toEqual([ID_A])
    expect(plan.download).toEqual([])
  })

  it("downloads relay images of active receipts missing locally", () => {
    const plan = planBlobSync({ remote: [ID_A, ID_B], local: [ID_B], rows: [row(ID_A), row(ID_B)] })
    expect(plan.download).toEqual([ID_A])
    expect(plan.upload).toEqual([])
  })

  it("does not download an image the relay does not have", () => {
    const plan = planBlobSync({ remote: [], local: [], rows: [row(ID_A)] })
    expect(plan.download).toEqual([])
  })

  it("deletes the images of deleted receipts on both sides", () => {
    const deleted = row(ID_A, "2026-02-01T00:00:00.000Z")
    const plan = planBlobSync({ remote: [ID_A], local: [ID_A], rows: [deleted] })
    expect(plan.deleteRemote).toEqual([ID_A])
    expect(plan.deleteLocal).toEqual([ID_A])
    expect(plan.upload).toEqual([])
  })

  it("keeps a relay image whose receipt row has not been pulled yet", () => {
    const plan = planBlobSync({ remote: [ID_C], local: [], rows: [] })
    expect(plan.deleteRemote).toEqual([])
    expect(plan.download).toEqual([])
  })

  it("keeps a relay image whose only trace is a local copy", () => {
    const plan = planBlobSync({ remote: [ID_C], local: [ID_C], rows: [] })
    expect(plan.deleteRemote).toEqual([])
    expect(plan.deleteLocal).toEqual([])
  })

  it("ignores staging images", () => {
    const staging = `staging-${ID_A}`
    const plan = planBlobSync({ remote: [], local: [staging], rows: [row(staging)] })
    expect(plan).toEqual({ upload: [], download: [], deleteRemote: [], deleteLocal: [] })
  })
})

describe("synchronizeBlobs", () => {
  let vault: Vault
  let relay: BlobRelay
  let config: SyncConfig

  beforeEach(async () => {
    vault = await deriveVault(generateMasterKey())
    relay = fakeBlobRelay(vault)
    config = { serverUrl: SERVER_URL, vault, fetch: relay.fetch }
  })

  it("carries a sealed image from one device to another", async () => {
    const image = new Uint8Array([1, 2, 3, 4])
    const sealed = await vault.encrypt(image)
    const [deviceA, deviceB] = [await createLocalDb(), await createLocalDb()]
    await insertReceipt(deviceA, ID_A, image)
    await insertReceipt(deviceB, ID_A, image)
    const storeA = memoryStore()
    const storeB = memoryStore()
    storeA.blobs.set(ID_A, sealed)

    const sent = await synchronizeBlobs(deviceA, config, storeA)
    const received = await synchronizeBlobs(deviceB, config, storeB)

    expect(sent).toMatchObject({ uploaded: 1, pending: 0, error: null })
    expect(relay.blobs.get(ID_A)).toEqual(sealed)
    expect(received).toMatchObject({ downloaded: 1, pending: 0, error: null })
    expect(storeB.blobs.get(ID_A)).toEqual(sealed)
  })

  it("rejects a downloaded image whose fingerprint does not match", async () => {
    const db = await createLocalDb()
    await insertReceipt(db, ID_A, new Uint8Array([1, 2, 3]))
    relay.blobs.set(ID_A, await vault.encrypt(new Uint8Array([9, 9, 9])))
    const store = memoryStore()

    const report = await synchronizeBlobs(db, config, store)

    expect(report.downloaded).toBe(0)
    expect(report.error).not.toBeNull()
    expect(store.blobs.has(ID_A)).toBe(false)
  })

  it("skips an image larger than the relay limit", async () => {
    const db = await createLocalDb()
    await insertReceipt(db, ID_A, new Uint8Array([1]))
    const store = memoryStore()
    store.blobs.set(ID_A, new Uint8Array(MAX_BLOB_BYTES + 1))

    const report = await synchronizeBlobs(db, config, store)

    expect(report.uploaded).toBe(0)
    expect(report.error).not.toBeNull()
    expect(relay.blobs.size).toBe(0)
  })

  it("removes the images of a deleted receipt everywhere", async () => {
    const db = await createLocalDb()
    const image = new Uint8Array([1, 2])
    await insertReceipt(db, ID_A, image)
    await db.update(receipts).set({ deletedAt: "2026-02-01T00:00:00.000Z" }).where(eq(receipts.id, ID_A))
    const sealed = await vault.encrypt(image)
    relay.blobs.set(ID_A, sealed)
    const store = memoryStore()
    store.blobs.set(ID_A, sealed)

    const report = await synchronizeBlobs(db, config, store)

    expect(report.deleted).toBe(1)
    expect(relay.blobs.size).toBe(0)
    expect(store.blobs.size).toBe(0)
  })

  it("caps the transfers of one cycle and reports the rest as pending", async () => {
    const db = await createLocalDb()
    for (let index = 0; index < MAX_BLOB_TRANSFERS + 2; index += 1) {
      const id = `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`
      await insertReceipt(db, id, new Uint8Array([index]))
      await db.update(receipts).set({ deletedAt: "2026-02-01T00:00:00.000Z" }).where(eq(receipts.id, id))
      relay.blobs.set(id, new Uint8Array([index]))
    }

    const report = await synchronizeBlobs(db, config, memoryStore())

    expect(report.deleted).toBe(MAX_BLOB_TRANSFERS)
    expect(report.pending).toBe(2)
  })

  it("stops on a network error without throwing", async () => {
    const db = await createLocalDb()
    const failing: SyncConfig = { ...config, fetch: () => Promise.reject(new Error("offline")) }

    const report = await synchronizeBlobs(db, failing, memoryStore())

    expect(report.error).not.toBeNull()
  })
})
