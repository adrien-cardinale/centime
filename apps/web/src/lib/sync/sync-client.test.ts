import { accounts, createProxyDb, type Db, receipts, runMigrations, transactions, transactionSplits } from "@centime/db"
import { eq } from "@centime/db/orm"
import initSqlJs from "sql.js"
import { beforeEach, describe, expect, it } from "bun:test"
import { deriveVault, type Vault } from "../crypto/envelope"
import { generateMasterKey } from "../crypto/master-key"
import { applyConnectionPragmas, createSqlJsExecutor } from "../local-db/sqljs-executor"
import { type FetchLike, SyncError, synchronize } from "./sync-client"
import { readSyncSettings } from "./sync-settings"

const SERVER_URL = "https://centime.test/"

type Relay = { fetch: FetchLike; entries: string[] }

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
}

function authorizationOf(init: RequestInit): string | undefined {
  return (init.headers as Record<string, string>).Authorization
}

/** Relais en mémoire : ne connaît que des blobs opaques, comme le vrai serveur. */
function fakeRelay(vault: Vault, beforeFirstPush?: () => Promise<void>): Relay {
  const entries: string[] = []
  let raced = false
  const { userId, secret } = vault.credentials
  const relayFetch: FetchLike = async (url, init) => {
    if (authorizationOf(init) !== `Bearer ${userId}.${secret}`) return json({ error: "Accès refusé" }, 401)
    const { pathname, searchParams } = new URL(url)
    if (pathname === "/api/log" && init.method === "GET") {
      const since = Number(searchParams.get("since"))
      const limit = Number(searchParams.get("limit"))
      const page = entries.slice(since, since + limit).map((data, index) => ({ seq: since + index + 1, data }))
      const cursor = page.at(-1)?.seq ?? since
      return json({ entries: page, cursor, hasMore: cursor < entries.length })
    }
    if (pathname === "/api/log" && init.method === "POST") {
      if (beforeFirstPush && !raced) {
        raced = true
        await beforeFirstPush()
      }
      entries.push((JSON.parse(String(init.body)) as { data: string }).data)
      return json({ seq: entries.length }, 201)
    }
    return json({ error: "Introuvable" }, 404)
  }
  return { fetch: relayFetch, entries }
}

async function createLocalDb(): Promise<Db> {
  const SQL = await initSqlJs()
  const database = new SQL.Database()
  applyConnectionPragmas(database)
  const db = createProxyDb(createSqlJsExecutor(database))
  await runMigrations(db)
  return db
}

async function insertAccount(db: Db, identifier: string, id?: string): Promise<string> {
  const [account] = await db
    .insert(accounts)
    .values({ ...(id ? { id } : {}), name: `Compte ${identifier}`, kind: "bank", identifier })
    .returning({ id: accounts.id })
  if (!account) throw new Error("Compte non créé")
  return account.id
}

async function insertTransaction(db: Db, accountId: string, fingerprint: string, rawLabel = "Achat"): Promise<string> {
  const [transaction] = await db
    .insert(transactions)
    .values({
      accountId,
      bookingDate: "2026-01-15",
      rawLabel,
      amount: -12.5,
      currency: "CHF",
      status: "booked",
      fingerprint,
    })
    .returning({ id: transactions.id })
  if (!transaction) throw new Error("Transaction non créée")
  return transaction.id
}

async function insertReceipt(db: Db, accountId: string, transactionId: string | null): Promise<string> {
  const [receipt] = await db
    .insert(receipts)
    .values({
      accountId,
      transactionId,
      capturedAt: "2026-01-15T10:00:00.000Z",
      mime: "image/jpeg",
      size: 1024,
      sha256: "a".repeat(64),
      status: transactionId === null ? "pending" : "linked",
    })
    .returning({ id: receipts.id })
  if (!receipt) throw new Error("Ticket non créé")
  return receipt.id
}

async function findTransaction(db: Db, id: string) {
  const [row] = await db.select().from(transactions).where(eq(transactions.id, id))
  return row
}

let vault: Vault
let relay: Relay
let deviceA: Db
let deviceB: Db

beforeEach(async () => {
  vault = await deriveVault(generateMasterKey())
  relay = fakeRelay(vault)
  deviceA = await createLocalDb()
  deviceB = await createLocalDb()
})

function sync(db: Db, options: { pullPageSize?: number; vault?: Vault; fetch?: FetchLike } = {}) {
  return synchronize(db, {
    serverUrl: SERVER_URL,
    vault: options.vault ?? vault,
    fetch: options.fetch ?? relay.fetch,
    pullPageSize: options.pullPageSize,
  })
}

describe("synchronize", () => {
  it("sends only ciphertext to the relay and lets another device read it", async () => {
    const accountId = await insertAccount(deviceA, "CH01")
    const transactionId = await insertTransaction(deviceA, accountId, "fp-1", "Boulangerie Dupont")

    const pushed = await sync(deviceA)

    expect(pushed.pushed).toBe(2)
    expect(relay.entries).toHaveLength(1)
    expect(relay.entries.join("")).not.toContain("Boulangerie")
    expect(atob(relay.entries.join("")).includes("Boulangerie")).toBe(false)

    const pulled = await sync(deviceB)
    expect(pulled.pulled).toBe(2)
    expect((await findTransaction(deviceB, transactionId))?.rawLabel).toBe("Boulangerie Dupont")
  })

  it("stamps pushed rows with the sequence and skips its own entries when pulling back", async () => {
    const accountId = await insertAccount(deviceA, "CH01")
    const transactionId = await insertTransaction(deviceA, accountId, "fp-1")

    const first = await sync(deviceA)
    const second = await sync(deviceA)

    expect(first.cursor).toBe(1)
    expect((await findTransaction(deviceA, transactionId))?.syncVersion).toBe(1)
    expect(second).toEqual({ pulled: 0, pushed: 0, cursor: 1, skipped: 0 })
    expect((await readSyncSettings(deviceA)).cursor).toBe(1)
  })

  it("propagates an edit made on another device", async () => {
    const accountId = await insertAccount(deviceA, "CH01")
    const transactionId = await insertTransaction(deviceA, accountId, "fp-1")
    await sync(deviceA)
    await sync(deviceB)

    await deviceB
      .update(transactions)
      .set({ merchant: "Boulangerie", updatedAt: "2099-01-01T00:00:00.000Z" })
      .where(eq(transactions.id, transactionId))
    await sync(deviceB)
    await sync(deviceA)

    expect((await findTransaction(deviceA, transactionId))?.merchant).toBe("Boulangerie")
  })

  it("keeps the newest row when an older entry is replayed", async () => {
    const accountId = await insertAccount(deviceA, "CH01")
    const transactionId = await insertTransaction(deviceA, accountId, "fp-1")
    await sync(deviceA)
    await deviceA
      .update(transactions)
      .set({ merchant: "Récent", updatedAt: "2099-01-01T00:00:00.000Z" })
      .where(eq(transactions.id, transactionId))
    await sync(deviceA)

    relay.entries.push(relay.entries[0] ?? "")
    await sync(deviceA)

    expect((await findTransaction(deviceA, transactionId))?.merchant).toBe("Récent")
  })

  it("replaces unsynchronized local duplicates that collide on unique keys", async () => {
    const remoteAccountId = await insertAccount(deviceA, "CH01")
    const remoteTransactionId = await insertTransaction(deviceA, remoteAccountId, "fp-shared")
    await sync(deviceA)
    const localAccountId = await insertAccount(deviceB, "CH01")
    const duplicateId = await insertTransaction(deviceB, localAccountId, "fp-shared")
    const localOnlyId = await insertTransaction(deviceB, localAccountId, "fp-local", "Achat local")

    await sync(deviceB)

    expect(await findTransaction(deviceB, duplicateId)).toBeUndefined()
    expect(await deviceB.select().from(accounts).where(eq(accounts.id, localAccountId))).toEqual([])
    expect((await findTransaction(deviceB, remoteTransactionId))?.accountId).toBe(remoteAccountId)
    expect((await findTransaction(deviceB, localOnlyId))?.accountId).toBe(remoteAccountId)

    await sync(deviceA)
    expect((await findTransaction(deviceA, localOnlyId))?.accountId).toBe(remoteAccountId)
  })

  it("converges when two devices create the same account concurrently", async () => {
    const lowId = "00000000-0000-4000-8000-000000000001"
    const highId = "ffffffff-0000-4000-8000-000000000002"
    await insertAccount(deviceA, "CH01", highId)
    const txA = await insertTransaction(deviceA, highId, "fp-a", "Achat A")
    await insertAccount(deviceB, "CH01", lowId)
    const txB = await insertTransaction(deviceB, lowId, "fp-b", "Achat B")
    // Device B pousse pendant que device A est entre son pull et son push.
    const racing = fakeRelay(vault, async () => void (await sync(deviceB, { fetch: racing.fetch })))
    relay = racing

    await sync(deviceA)
    await sync(deviceB)
    await sync(deviceA)
    await sync(deviceB)

    for (const device of [deviceA, deviceB]) {
      const rows = await device.select().from(accounts)
      expect(rows.map((account) => account.id)).toEqual([lowId])
      expect((await findTransaction(device, txA))?.accountId).toBe(lowId)
      expect((await findTransaction(device, txB))?.accountId).toBe(lowId)
    }
  })

  it("follows pagination until the relay has no more entries", async () => {
    const accountId = await insertAccount(deviceA, "CH01")
    await insertTransaction(deviceA, accountId, "fp-0")
    await sync(deviceA)
    for (let index = 1; index < 5; index += 1) {
      await insertTransaction(deviceA, accountId, `fp-${index}`)
      await sync(deviceA)
    }

    const report = await sync(deviceB, { pullPageSize: 2 })

    expect(report.pulled).toBe(6)
    expect(report.cursor).toBe(5)
    expect(await deviceB.select().from(transactions)).toHaveLength(5)
  })

  it("records a clear error when the key does not match the account", async () => {
    const stranger = await deriveVault(generateMasterKey())
    const refused = sync(deviceA, { vault: stranger })

    await expect(refused).rejects.toBeInstanceOf(SyncError)
    expect((await readSyncSettings(deviceA)).lastError).toContain("la clé ne correspond pas")
  })

  it("skips an entry it cannot decrypt instead of blocking sync forever", async () => {
    const accountId = await insertAccount(deviceA, "CH01")
    await insertTransaction(deviceA, accountId, "fp-1")
    await sync(deviceA)
    relay.entries.push(btoa("n'importe quoi qui n'est pas chiffré, vraiment pas"))

    const report = await sync(deviceB)

    expect(report.skipped).toBe(1)
    expect(report.pulled).toBe(2)
    expect(report.cursor).toBe(2)
    expect(await deviceB.select().from(transactions)).toHaveLength(1)
    expect((await sync(deviceB)).skipped).toBe(0)
  })

  it("skips an entry written with a newer payload version", async () => {
    relay.entries.push(await vault.encryptText(JSON.stringify({ v: 2, changes: {} })))

    const report = await sync(deviceA)

    expect(report).toMatchObject({ skipped: 1, cursor: 1 })
  })

  it("ignores unknown columns added by a newer app version", async () => {
    const accountId = await insertAccount(deviceA, "CH01")
    await sync(deviceA)
    const [account] = await deviceA.select().from(accounts)
    if (!account) throw new Error("Compte absent")
    const future = { ...account, futureColumn: "valeur inconnue" }
    relay.entries.push(await vault.encryptText(JSON.stringify({ v: 1, changes: { accounts: [future] } })))

    const report = await sync(deviceB)

    expect(report.skipped).toBe(0)
    expect((await deviceB.select().from(accounts)).map((row) => row.id)).toEqual([accountId])
  })

  it("keeps offline edits when an older duplicate arrives from another device", async () => {
    const remoteAccountId = await insertAccount(deviceA, "CH01")
    const remoteTransactionId = await insertTransaction(deviceA, remoteAccountId, "fp-shared")
    await sync(deviceA)
    const localAccountId = await insertAccount(deviceB, "CH01")
    const localId = await insertTransaction(deviceB, localAccountId, "fp-shared")
    await deviceB
      .update(transactions)
      .set({ merchant: "Boulangerie", updatedAt: "2099-01-01T00:00:00.000Z" })
      .where(eq(transactions.id, localId))

    await sync(deviceB)

    const merged = await findTransaction(deviceB, remoteTransactionId)
    expect(await findTransaction(deviceB, localId)).toBeUndefined()
    expect(merged?.merchant).toBe("Boulangerie")

    await sync(deviceA)
    expect((await findTransaction(deviceA, remoteTransactionId))?.merchant).toBe("Boulangerie")
  })

  it("moves the splits of a merged duplicate onto the winning transaction", async () => {
    const remoteAccountId = await insertAccount(deviceA, "CH01")
    const remoteTransactionId = await insertTransaction(deviceA, remoteAccountId, "fp-shared")
    await sync(deviceA)
    const localAccountId = await insertAccount(deviceB, "CH01")
    const localId = await insertTransaction(deviceB, localAccountId, "fp-shared")
    await deviceB.insert(transactionSplits).values([
      { transactionId: localId, amount: -10, position: 0 },
      { transactionId: localId, amount: -2.5, position: 1 },
    ])

    await sync(deviceB)

    const splits = await deviceB.select().from(transactionSplits)
    expect(splits.map((split) => split.transactionId)).toEqual([remoteTransactionId, remoteTransactionId])
  })

  it("moves the receipts of a merged duplicate onto the winning account and transaction", async () => {
    const remoteAccountId = await insertAccount(deviceA, "CH01")
    const remoteTransactionId = await insertTransaction(deviceA, remoteAccountId, "fp-shared")
    await sync(deviceA)
    const localAccountId = await insertAccount(deviceB, "CH01")
    const localId = await insertTransaction(deviceB, localAccountId, "fp-shared")
    const receiptId = await insertReceipt(deviceB, localAccountId, localId)

    await sync(deviceB)

    const [receipt] = await deviceB.select().from(receipts).where(eq(receipts.id, receiptId))
    expect(receipt?.accountId).toBe(remoteAccountId)
    expect(receipt?.transactionId).toBe(remoteTransactionId)
  })

  it("remaps an incoming receipt that still points to a merged duplicate", async () => {
    const remoteAccountId = await insertAccount(deviceA, "CH01")
    const remoteTransactionId = await insertTransaction(deviceA, remoteAccountId, "fp-shared")
    await sync(deviceA)
    const localAccountId = await insertAccount(deviceB, "CH01")
    const localId = await insertTransaction(deviceB, localAccountId, "fp-shared")
    await sync(deviceB)
    const receipt = {
      id: crypto.randomUUID(),
      accountId: localAccountId,
      transactionId: localId,
      capturedAt: "2026-01-15T10:00:00.000Z",
      mime: "image/jpeg",
      size: 1024,
      sha256: "b".repeat(64),
      merchant: null,
      total: 12.5,
      receiptDate: "2026-01-15",
      note: null,
      linesJson: null,
      status: "linked",
      createdAt: "2026-01-15T10:00:00.000Z",
      updatedAt: "2026-01-15T10:00:00.000Z",
      deletedAt: null,
    }
    relay.entries.push(await vault.encryptText(JSON.stringify({ v: 1, changes: { receipts: [receipt] } })))

    await sync(deviceB)

    const [stored] = await deviceB.select().from(receipts).where(eq(receipts.id, receipt.id))
    expect(stored?.accountId).toBe(remoteAccountId)
    expect(stored?.transactionId).toBe(remoteTransactionId)
  })

  it("reports an unreachable server as a network error", async () => {
    const unreachable: FetchLike = async () => {
      throw new TypeError("fetch failed")
    }

    await expect(sync(deviceA, { fetch: unreachable })).rejects.toMatchObject({ kind: "network" })
  })
})
