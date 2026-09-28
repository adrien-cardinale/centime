import { categories, type Db } from "@centime/db"
import { beforeEach, describe, expect, it } from "bun:test"
import { createApi } from "../app"
import type { Config } from "../config"
import { createTestDb, readJson, withErrorHandling } from "../test-support/database"
import { createSyncRoutes } from "./sync"

const PASSWORD = "mot-de-passe-de-test"

const config: Config = {
  port: 0,
  databaseUrl: ":memory:",
  appPassword: PASSWORD,
  sessionSecret: "secret-de-session-de-test-suffisamment-long",
  staticDir: "",
  isProduction: false,
}

type PullBody = { cursor: number; hasMore: boolean; changes: Record<string, { id: string }[]> }
type TokenBody = { token: string; label: string }
type TokenListBody = { id: string; label: string; revokedAt: string | null }[]

let db: Db

function json(method: string, body: unknown, headers: Record<string, string> = {}): RequestInit {
  return { method, headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) }
}

function bearer(token: string): RequestInit {
  return { headers: { Authorization: `Bearer ${token}` } }
}

async function requestToken(password = PASSWORD): Promise<Response> {
  return createApi({ db, config }).request("/api/auth/token", json("POST", { password, label: "Bureau" }))
}

async function loginCookie(): Promise<string> {
  const response = await createApi({ db, config }).request("/api/auth/login", json("POST", { password: PASSWORD }))
  return (response.headers.get("Set-Cookie") ?? "").split(";")[0] ?? ""
}

beforeEach(async () => {
  db = await createTestDb()
})

describe("API tokens", () => {
  it("refuses a wrong password", async () => {
    expect((await requestToken("mauvais")).status).toBe(401)
  })

  it("authorizes sync requests with a bearer token", async () => {
    const response = await requestToken()
    expect(response.status).toBe(201)
    const { token, label } = await readJson<TokenBody>(response)
    expect(label).toBe("Bureau")
    expect(token).toMatch(/^[0-9a-f]{64}$/)

    const api = createApi({ db, config })
    expect((await api.request("/api/sync/pull?since=0")).status).toBe(401)
    expect((await api.request("/api/sync/pull?since=0", bearer(token))).status).toBe(200)
    expect((await api.request("/api/sync/pull?since=0", bearer("inconnu"))).status).toBe(401)
  })

  it("refuses a revoked token", async () => {
    const { token } = await readJson<TokenBody>(await requestToken())
    const api = createApi({ db, config })
    const cookie = await loginCookie()

    expect((await api.request("/api/auth/tokens", bearer(token))).status).toBe(401)
    const list = await readJson<TokenListBody>(await api.request("/api/auth/tokens", { headers: { Cookie: cookie } }))
    expect(list).toMatchObject([{ label: "Bureau", revokedAt: null }])
    expect(JSON.stringify(list)).not.toContain(token)

    const revoked = await api.request(`/api/auth/tokens/${list[0]?.id}`, { method: "DELETE", headers: { Cookie: cookie } })
    expect(revoked.status).toBe(200)
    expect((await api.request("/api/sync/pull?since=0", bearer(token))).status).toBe(401)
  })
})

describe("sync routes", () => {
  it("paginates the pull with the configured limit", async () => {
    await db.insert(categories).values(["A", "B", "C"].map((name) => ({ name, color: "#4a84c4" })))
    const routes = withErrorHandling(createSyncRoutes(db, { pullLimit: 2 }))

    const first = await readJson<PullBody>(await routes.request("/pull?since=0"))
    expect(first).toMatchObject({ cursor: 2, hasMore: true })
    expect(first.changes.categories).toHaveLength(2)

    const second = await readJson<PullBody>(await routes.request(`/pull?since=${first.cursor}`))
    expect(second).toMatchObject({ cursor: 3, hasMore: false })
    expect(second.changes.categories).toHaveLength(1)
  })

  it("rejects an unknown table or column", async () => {
    const routes = withErrorHandling(createSyncRoutes(db))
    expect((await routes.request("/push", json("POST", { changes: { sessions: [] } }))).status).toBe(400)
    const row = { id: crypto.randomUUID(), name: "X", unknown: true }
    expect((await routes.request("/push", json("POST", { changes: { categories: [row] } }))).status).toBe(400)
  })
})
