import { accounts, createProxyDb, type Db, runMigrations, transactions } from "@centime/db"
import { createDb } from "@centime/db/node"
import { eq } from "@centime/db/orm"
import { pullChanges, pushChanges } from "@centime/services"
import initSqlJs from "sql.js"
import { beforeEach, describe, expect, it } from "bun:test"
import { applyConnectionPragmas, createSqlJsExecutor } from "../local-db/sqljs-executor"
import { type FetchLike, SyncError, synchronize } from "./sync-client"
import { readSyncSettings } from "./sync-settings"

const TOKEN = "jeton-de-test"
const SERVER_URL = "https://centime.test/"

type ServerOptions = { pullLimit?: number; beforePush?: () => Promise<void> }

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
}

function authorizationOf(init: RequestInit): string | undefined {
  const headers: Record<string, string> = init.headers as Record<string, string>
  return headers.Authorization
}

function fakeServer(serverDb: Db, options: ServerOptions = {}): FetchLike {
  return async (url, init) => {
    if (authorizationOf(init) !== `Bearer ${TOKEN}`) return json({ error: "Non authentifié" }, 401)
    const { pathname, searchParams } = new URL(url)
    if (pathname === "/api/sync/pull") {
      return json(await pullChanges(serverDb, { since: Number(searchParams.get("since")), limit: options.pullLimit }))
    }
    if (pathname === "/api/sync/push") {
      await options.beforePush?.()
      return json(await pushChanges(serverDb, JSON.parse(String(init.body))))
    }
    return json({ error: "Introuvable" }, 404)
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

async function createServerDb(): Promise<Db> {
  const db = createDb(":memory:")
  await runMigrations(db)
  return db
}

async function insertAccount(db: Db, identifier: string): Promise<string> {
  const [account] = await db
    .insert(accounts)
    .values({ name: `Compte ${identifier}`, kind: "bank", identifier })
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

async function findTransaction(db: Db, id: string) {
  const [row] = await db.select().from(transactions).where(eq(transactions.id, id))
  return row
}

let localDb: Db
let serverDb: Db

beforeEach(async () => {
  localDb = await createLocalDb()
  serverDb = await createServerDb()
})

function sync(options: ServerOptions = {}) {
  return synchronize(localDb, { serverUrl: SERVER_URL, token: TOKEN, fetch: fakeServer(serverDb, options) })
}

describe("synchronize", () => {
  it("pulls every server row on the first synchronization", async () => {
    const accountId = await insertAccount(serverDb, "CH01")
    const transactionId = await insertTransaction(serverDb, accountId, "fp-1")

    const report = await sync()

    expect(report).toEqual({ pulled: 2, pushed: 0, rejected: 0, cursor: 2 })
    const local = await findTransaction(localDb, transactionId)
    const remote = await findTransaction(serverDb, transactionId)
    expect(local).toEqual(remote)
    expect((await readSyncSettings(localDb)).cursor).toBe(2)
  })

  it("pushes a local change and stamps it with the server version", async () => {
    const accountId = await insertAccount(serverDb, "CH01")
    const transactionId = await insertTransaction(serverDb, accountId, "fp-1")
    await sync()

    await localDb.update(transactions).set({ merchant: "Boulangerie" }).where(eq(transactions.id, transactionId))
    const report = await sync()

    const remote = await findTransaction(serverDb, transactionId)
    const local = await findTransaction(localDb, transactionId)
    expect(report.pushed).toBe(1)
    expect(remote?.merchant).toBe("Boulangerie")
    expect(local?.syncVersion).toBe(remote?.syncVersion)
    expect(remote?.syncVersion).toBe(report.cursor)
  })

  it("applies the server row when the push is rejected by last-write-wins", async () => {
    const accountId = await insertAccount(serverDb, "CH01")
    const transactionId = await insertTransaction(serverDb, accountId, "fp-1")
    await sync()
    await localDb.update(transactions).set({ merchant: "Local" }).where(eq(transactions.id, transactionId))

    const report = await sync({
      beforePush: async () => {
        await serverDb
          .update(transactions)
          .set({ merchant: "Serveur", updatedAt: "2099-01-01T00:00:00.000Z" })
          .where(eq(transactions.id, transactionId))
      },
    })

    const local = await findTransaction(localDb, transactionId)
    const remote = await findTransaction(serverDb, transactionId)
    expect(report.rejected).toBe(1)
    expect(local?.merchant).toBe("Serveur")
    expect(local?.syncVersion).not.toBeNull()
    expect(local?.syncVersion).toBe(remote?.syncVersion)
  })

  it("replaces unsynchronized local duplicates that collide on unique keys", async () => {
    const serverAccountId = await insertAccount(serverDb, "CH01")
    const serverTransactionId = await insertTransaction(serverDb, serverAccountId, "fp-shared")
    const localAccountId = await insertAccount(localDb, "CH01")
    const duplicateId = await insertTransaction(localDb, localAccountId, "fp-shared")
    const localOnlyId = await insertTransaction(localDb, localAccountId, "fp-local", "Achat local")

    await sync()

    expect(await findTransaction(localDb, duplicateId)).toBeUndefined()
    expect(await localDb.select().from(accounts).where(eq(accounts.id, localAccountId))).toEqual([])
    expect((await findTransaction(localDb, serverTransactionId))?.accountId).toBe(serverAccountId)
    const pushed = await findTransaction(serverDb, localOnlyId)
    expect(pushed?.accountId).toBe(serverAccountId)
    expect((await findTransaction(localDb, localOnlyId))?.syncVersion).toBe(pushed?.syncVersion)
  })

  it("follows pagination until the server has no more changes", async () => {
    const accountId = await insertAccount(serverDb, "CH01")
    for (let index = 0; index < 5; index += 1) await insertTransaction(serverDb, accountId, `fp-${index}`)

    const report = await sync({ pullLimit: 2 })

    expect(report.pulled).toBe(6)
    expect(report.cursor).toBe(6)
    expect(await localDb.select().from(transactions)).toHaveLength(5)
  })

  it("records a clear error when the token is refused", async () => {
    const refused = synchronize(localDb, { serverUrl: SERVER_URL, token: "faux", fetch: fakeServer(serverDb) })

    await expect(refused).rejects.toBeInstanceOf(SyncError)
    expect((await readSyncSettings(localDb)).lastError).toBe("Jeton refusé, reconnecte-toi")
  })

  it("reports an unreachable server as a network error", async () => {
    const unreachable: FetchLike = async () => {
      throw new TypeError("fetch failed")
    }
    const failure = synchronize(localDb, { serverUrl: SERVER_URL, token: TOKEN, fetch: unreachable })

    await expect(failure).rejects.toMatchObject({ kind: "network" })
  })
})
