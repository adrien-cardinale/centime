import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { createApi } from "./app"
import { openStore, type Store } from "./store"

const USER_A = "a".repeat(32)
const USER_B = "b".repeat(32)
const SECRET = "s".repeat(43)
const OTHER_SECRET = "t".repeat(43)

let store: Store
let api: ReturnType<typeof createApi>

function bearer(userId: string, secret = SECRET): Record<string, string> {
  return { Authorization: `Bearer ${userId}.${secret}` }
}

function post(data: unknown, headers: Record<string, string> = bearer(USER_A)) {
  return api.request("/api/log", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ data }),
  })
}

function get(query = "", headers: Record<string, string> = bearer(USER_A)) {
  return api.request(`/api/log${query}`, { headers })
}

function setup(allowSignup = true): void {
  store = openStore(":memory:", { allowSignup })
  api = createApi({ store })
}

beforeEach(() => setup())
afterEach(() => store.close())

describe("health", () => {
  test("répond sans authentification", async () => {
    const response = await api.request("/api/health")
    expect(await response.json()).toEqual({ status: "ok" })
  })
})

describe("POST /api/log", () => {
  test("inscrit implicitement puis numérote 1, 2, 3", async () => {
    for (const expected of [1, 2, 3]) {
      const response = await post("QUJD")
      expect(response.status).toBe(201)
      expect(await response.json()).toEqual({ seq: expected })
    }
  })

  test("numérote séparément chaque utilisateur", async () => {
    await post("QUJD")
    await post("QUJD")
    const response = await post("QUJD", bearer(USER_B, OTHER_SECRET))
    expect(await response.json()).toEqual({ seq: 1 })
  })

  test("refuse un mauvais secret pour un utilisateur connu", async () => {
    await post("QUJD")
    const response = await post("QUJD", bearer(USER_A, OTHER_SECRET))
    expect(response.status).toBe(401)
  })

  test("refuse une authentification mal formée", async () => {
    const malformed: Record<string, string>[] = [
      {},
      { Authorization: "Basic abc" },
      { Authorization: `Bearer ${USER_A}` },
      { Authorization: `Bearer ${"A".repeat(32)}.${SECRET}` },
      { Authorization: `Bearer ${USER_A}.court` },
      { Authorization: `Bearer ${USER_A}.${SECRET}.extra` },
    ]
    for (const headers of malformed) expect((await post("QUJD", headers)).status).toBe(401)
  })

  test("refuse des données invalides", async () => {
    for (const data of ["", "pas du base64!", 12, null, "A".repeat(8 * 1024 * 1024 + 1)]) {
      const response = await post(data)
      expect(response.status).toBe(400)
      expect(await response.json()).toHaveProperty("error")
    }
    const noBody = await api.request("/api/log", { method: "POST", headers: bearer(USER_A), body: "nope" })
    expect(noBody.status).toBe(400)
  })

  test("ne crée pas d'utilisateur quand les données sont invalides", async () => {
    await post("")
    expect(store.check(USER_A, "x")).toBe("unknown")
  })

  test("refuse l'inscription quand elle est fermée mais accepte les utilisateurs existants", async () => {
    store.close()
    setup(false)
    const response = await post("QUJD")
    expect(response.status).toBe(403)
    expect(await response.json()).toHaveProperty("error")
    expect((await get()).status).toBe(200)
  })

  test("accepte les utilisateurs existants quand l'inscription est fermée ensuite", async () => {
    const path = `${import.meta.dir}/../.tmp-relay-${crypto.randomUUID()}.db`
    const open = openStore(path)
    try {
      const { parseCredentials } = await import("./auth")
      const credentials = await parseCredentials(`Bearer ${USER_A}.${SECRET}`)
      if (!credentials) throw new Error("identifiants invalides")
      open.append(USER_A, credentials.secretHash, "QUJD")
      open.close()
      const reopened = openStore(path, { allowSignup: false })
      expect(reopened.append(USER_A, credentials.secretHash, "QUJD")).toEqual({ kind: "ok", seq: 2 })
      reopened.close()
    } finally {
      for (const suffix of ["", "-wal", "-shm"]) await Bun.file(`${path}${suffix}`).delete().catch(() => undefined)
    }
  })
})

describe("GET /api/log", () => {
  test("renvoie les entrées après since, dans l'ordre", async () => {
    await post("QUJD")
    await post("REVG")
    await post("R0hJ")
    const body = await (await get("?since=1")).json()
    expect(body).toEqual({
      entries: [
        { seq: 2, data: "REVG" },
        { seq: 3, data: "R0hJ" },
      ],
      cursor: 3,
      hasMore: false,
    })
  })

  test("pagine avec limit et hasMore", async () => {
    for (let index = 0; index < 5; index += 1) await post("QUJD")
    const first = await (await get("?since=0&limit=2")).json()
    expect(first.entries.map((entry: { seq: number }) => entry.seq)).toEqual([1, 2])
    expect(first).toMatchObject({ cursor: 2, hasMore: true })
    const last = await (await get("?since=4&limit=2")).json()
    expect(last).toMatchObject({ cursor: 5, hasMore: false })
  })

  test("plafonne limit à 500 et refuse les paramètres invalides", async () => {
    expect((await get("?limit=100000")).status).toBe(200)
    expect((await get("?since=-1")).status).toBe(400)
    expect((await get("?limit=0")).status).toBe(400)
    expect((await get("?since=abc")).status).toBe(400)
  })

  test("utilisateur inconnu : liste vide sans création", async () => {
    const response = await get("?since=7")
    expect(await response.json()).toEqual({ entries: [], cursor: 7, hasMore: false })
    expect(store.check(USER_A, "x")).toBe("unknown")
  })

  test("mauvais secret ou format invalide : 401", async () => {
    await post("QUJD")
    expect((await get("", bearer(USER_A, OTHER_SECRET))).status).toBe(401)
    expect((await get("", {})).status).toBe(401)
  })

  test("isole les utilisateurs", async () => {
    await post("QUJD")
    await post("REVG", bearer(USER_B, OTHER_SECRET))
    const body = await (await get("", bearer(USER_B, OTHER_SECRET))).json()
    expect(body.entries).toEqual([{ seq: 1, data: "REVG" }])
  })

  test("plafonne la taille d'une page en gardant au moins une entrée", async () => {
    const big = "A".repeat(5 * 1024 * 1024)
    await post(big)
    await post(big)
    const first = await (await get()).json()
    expect(first.entries).toHaveLength(1)
    expect(first).toMatchObject({ cursor: 1, hasMore: true })
    const second = await (await get("?since=1")).json()
    expect(second).toMatchObject({ cursor: 2, hasMore: false })
  })
})

describe("DELETE /api/account", () => {
  test("supprime l'utilisateur et son journal", async () => {
    await post("QUJD")
    await post("QUJD", bearer(USER_B, OTHER_SECRET))
    const response = await api.request("/api/account", { method: "DELETE", headers: bearer(USER_A) })
    expect(response.status).toBe(204)
    expect(await (await get()).json()).toEqual({ entries: [], cursor: 0, hasMore: false })
    expect((await get("", bearer(USER_B, OTHER_SECRET))).status).toBe(200)
    expect(store.read(USER_B, 0, 10).entries).toHaveLength(1)
    expect(store.read(USER_A, 0, 10).entries).toHaveLength(0)
  })

  test("refuse sans identifiants valides", async () => {
    await post("QUJD")
    const wrong = await api.request("/api/account", { method: "DELETE", headers: bearer(USER_A, OTHER_SECRET) })
    expect(wrong.status).toBe(401)
    const unknown = await api.request("/api/account", { method: "DELETE", headers: bearer(USER_B) })
    expect(unknown.status).toBe(401)
    expect(store.read(USER_A, 0, 10).entries).toHaveLength(1)
  })
})

describe("quota de stockage", () => {
  test("refuse l'écriture au-delà du quota par utilisateur", async () => {
    store.close()
    store = openStore(":memory:", { maxUserBytes: 10 })
    api = createApi({ store })
    expect((await post("QUJD")).status).toBe(201)
    expect((await post("QUJD")).status).toBe(201)
    const refused = await post("QUJD")
    expect(refused.status).toBe(413)
    expect(await refused.json()).toHaveProperty("error")
    expect((await get()).json()).resolves.toMatchObject({ cursor: 2 })
  })

  test("le quota est compté par utilisateur", async () => {
    store.close()
    store = openStore(":memory:", { maxUserBytes: 6 })
    api = createApi({ store })
    expect((await post("QUJD")).status).toBe(201)
    expect((await post("QUJD")).status).toBe(413)
    expect((await post("QUJD", bearer(USER_B, OTHER_SECRET))).status).toBe(201)
  })
})

describe("limitation de débit", () => {
  test("limite les requêtes par minute et par client", async () => {
    api = createApi({ store, rateLimitPerMinute: 2 })
    expect((await post("QUJD")).status).toBe(201)
    expect((await post("QUJD")).status).toBe(201)
    const limited = await post("QUJD")
    expect(limited.status).toBe(429)
    expect(await limited.json()).toHaveProperty("error")
    expect((await post("QUJD", bearer(USER_B, OTHER_SECRET))).status).toBe(201)
  })
})

describe("CORS", () => {
  const ALLOWED_ORIGIN = "https://example.github.io"

  function preflight(origin: string) {
    return api.request("/api/log", {
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Authorization, Content-Type",
      },
    })
  }

  test("autorise une origine listée", async () => {
    api = createApi({ store, allowedOrigins: [ALLOWED_ORIGIN] })
    const response = await preflight(ALLOWED_ORIGIN)
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(ALLOWED_ORIGIN)
    expect(response.headers.get("Access-Control-Allow-Headers")).toBe("Authorization,Content-Type")
  })

  test("ignore une origine non listée", async () => {
    api = createApi({ store, allowedOrigins: [ALLOWED_ORIGIN] })
    const response = await preflight("https://autre.example")
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull()
  })

  test("n'envoie aucun en-tête CORS sans origine configurée", async () => {
    const response = await preflight(ALLOWED_ORIGIN)
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull()
  })
})

describe("routes inconnues", () => {
  test("renvoient une erreur JSON", async () => {
    const response = await api.request("/api/budgets")
    expect(response.status).toBe(404)
    expect(await response.json()).toHaveProperty("error")
  })
})
