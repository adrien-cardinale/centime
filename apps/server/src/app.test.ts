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

const BLOB_ID = "0b6f1c2e-6a4d-4c1f-9d1e-3f2a1b0c9d8e"
const OTHER_BLOB_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7"

function putBlob(id: string, bytes: Uint8Array<ArrayBuffer>, headers: Record<string, string> = bearer(USER_A)) {
  return api.request(`/api/blob/${id}`, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/octet-stream" },
    body: bytes,
  })
}

function getBlob(id: string, headers: Record<string, string> = bearer(USER_A)) {
  return api.request(`/api/blob/${id}`, { headers })
}

function deleteBlob(id: string, headers: Record<string, string> = bearer(USER_A)) {
  return api.request(`/api/blob/${id}`, { method: "DELETE", headers })
}

function listBlobs(headers: Record<string, string> = bearer(USER_A)) {
  return api.request("/api/blob", { headers })
}

function bytesOf(...values: number[]): Uint8Array<ArrayBuffer> {
  return new Uint8Array(values)
}

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

  test("supprime aussi les fichiers de l'utilisateur", async () => {
    await putBlob(BLOB_ID, bytesOf(1))
    await putBlob(BLOB_ID, bytesOf(2), bearer(USER_B, OTHER_SECRET))
    expect((await api.request("/api/account", { method: "DELETE", headers: bearer(USER_A) })).status).toBe(204)
    expect(store.listBlobs(USER_A)).toEqual([])
    expect(store.getBlob(USER_A, BLOB_ID)).toBeNull()
    expect(store.listBlobs(USER_B)).toEqual([BLOB_ID])
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

  test("autorise la méthode PUT pour les fichiers", async () => {
    api = createApi({ store, allowedOrigins: [ALLOWED_ORIGIN] })
    const response = await preflight(ALLOWED_ORIGIN)
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("PUT")
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

describe("PUT /api/blob/:id", () => {
  test("crée le fichier (201) puis le remplace (204)", async () => {
    expect((await putBlob(BLOB_ID, bytesOf(1, 2, 3))).status).toBe(201)
    expect((await putBlob(BLOB_ID, bytesOf(4, 5))).status).toBe(204)
    const response = await getBlob(BLOB_ID)
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytesOf(4, 5))
  })

  test("inscrit implicitement un utilisateur inconnu", async () => {
    expect((await putBlob(BLOB_ID, bytesOf(1))).status).toBe(201)
    expect(store.check(USER_A, "x")).toBe("unauthorized")
    expect((await post("QUJD")).status).toBe(201)
  })

  test("refuse l'inscription quand elle est fermée", async () => {
    store.close()
    setup(false)
    const response = await putBlob(BLOB_ID, bytesOf(1))
    expect(response.status).toBe(403)
    expect(await response.json()).toHaveProperty("error")
    expect(store.check(USER_A, "x")).toBe("unknown")
  })

  test("refuse un mauvais secret ou une authentification absente", async () => {
    await putBlob(BLOB_ID, bytesOf(1))
    expect((await putBlob(BLOB_ID, bytesOf(2), bearer(USER_A, OTHER_SECRET))).status).toBe(401)
    expect((await putBlob(BLOB_ID, bytesOf(2), {})).status).toBe(401)
    const response = await getBlob(BLOB_ID)
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytesOf(1))
  })

  test("refuse un identifiant qui n'est pas un UUID", async () => {
    for (const id of ["abc", "0b6f1c2e6a4d4c1f9d1e3f2a1b0c9d8e", `${BLOB_ID}x`]) {
      const response = await putBlob(id, bytesOf(1))
      expect(response.status).toBe(400)
      expect(await response.json()).toHaveProperty("error")
    }
    expect(store.check(USER_A, "x")).toBe("unknown")
  })

  test("accepte un UUID en majuscules comme le même fichier", async () => {
    expect((await putBlob(BLOB_ID.toUpperCase(), bytesOf(1))).status).toBe(201)
    expect((await putBlob(BLOB_ID, bytesOf(2))).status).toBe(204)
    expect(await (await listBlobs()).json()).toEqual({ ids: [BLOB_ID] })
  })

  test("refuse un corps vide", async () => {
    const response = await putBlob(BLOB_ID, new Uint8Array())
    expect(response.status).toBe(400)
    expect(store.check(USER_A, "x")).toBe("unknown")
  })

  test("refuse un fichier de plus de 8 Mo", async () => {
    const response = await putBlob(BLOB_ID, new Uint8Array(8 * 1024 * 1024 + 1))
    expect(response.status).toBe(413)
    expect(await response.json()).toHaveProperty("error")
    expect((await putBlob(BLOB_ID, new Uint8Array(8 * 1024 * 1024))).status).toBe(201)
  })
})

describe("GET /api/blob/:id", () => {
  test("renvoie les octets en application/octet-stream", async () => {
    await putBlob(BLOB_ID, bytesOf(0, 255, 128))
    const response = await getBlob(BLOB_ID)
    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe("application/octet-stream")
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytesOf(0, 255, 128))
  })

  test("404 pour un fichier absent ou un utilisateur inconnu", async () => {
    const unknownUser = await getBlob(BLOB_ID)
    expect(unknownUser.status).toBe(404)
    expect(await unknownUser.json()).toHaveProperty("error")
    await putBlob(BLOB_ID, bytesOf(1))
    expect((await getBlob(OTHER_BLOB_ID)).status).toBe(404)
  })

  test("isole les utilisateurs", async () => {
    await putBlob(BLOB_ID, bytesOf(1))
    expect((await getBlob(BLOB_ID, bearer(USER_B, OTHER_SECRET))).status).toBe(404)
  })

  test("401 avec un mauvais secret et 400 avec un identifiant invalide", async () => {
    await putBlob(BLOB_ID, bytesOf(1))
    expect((await getBlob(BLOB_ID, bearer(USER_A, OTHER_SECRET))).status).toBe(401)
    expect((await getBlob(BLOB_ID, {})).status).toBe(401)
    expect((await getBlob("pas-un-uuid")).status).toBe(400)
  })
})

describe("DELETE /api/blob/:id", () => {
  test("supprime le fichier et reste idempotent", async () => {
    await putBlob(BLOB_ID, bytesOf(1))
    expect((await deleteBlob(BLOB_ID)).status).toBe(204)
    expect((await getBlob(BLOB_ID)).status).toBe(404)
    expect((await deleteBlob(BLOB_ID)).status).toBe(204)
    expect((await deleteBlob(OTHER_BLOB_ID, bearer(USER_B, OTHER_SECRET))).status).toBe(204)
  })

  test("ne touche pas aux fichiers d'un autre utilisateur", async () => {
    await putBlob(BLOB_ID, bytesOf(1))
    await putBlob(BLOB_ID, bytesOf(2), bearer(USER_B, OTHER_SECRET))
    await deleteBlob(BLOB_ID, bearer(USER_B, OTHER_SECRET))
    expect((await getBlob(BLOB_ID)).status).toBe(200)
  })

  test("401 avec un mauvais secret et 400 avec un identifiant invalide", async () => {
    await putBlob(BLOB_ID, bytesOf(1))
    expect((await deleteBlob(BLOB_ID, bearer(USER_A, OTHER_SECRET))).status).toBe(401)
    expect((await deleteBlob("pas-un-uuid")).status).toBe(400)
    expect((await getBlob(BLOB_ID)).status).toBe(200)
  })
})

describe("GET /api/blob", () => {
  test("liste les identifiants de l'utilisateur", async () => {
    await putBlob(OTHER_BLOB_ID, bytesOf(1))
    await putBlob(BLOB_ID, bytesOf(2))
    await putBlob(BLOB_ID, bytesOf(3), bearer(USER_B, OTHER_SECRET))
    expect(await (await listBlobs()).json()).toEqual({ ids: [BLOB_ID, OTHER_BLOB_ID] })
    await deleteBlob(OTHER_BLOB_ID)
    expect(await (await listBlobs()).json()).toEqual({ ids: [BLOB_ID] })
  })

  test("liste vide pour un utilisateur inconnu, sans création", async () => {
    const response = await listBlobs()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ids: [] })
    expect(store.check(USER_A, "x")).toBe("unknown")
  })

  test("401 avec un mauvais secret", async () => {
    await putBlob(BLOB_ID, bytesOf(1))
    expect((await listBlobs(bearer(USER_A, OTHER_SECRET))).status).toBe(401)
    expect((await listBlobs({})).status).toBe(401)
  })
})

describe("quota de stockage des fichiers", () => {
  function withQuota(maxUserBytes: number): void {
    store.close()
    store = openStore(":memory:", { maxUserBytes })
    api = createApi({ store })
  }

  test("compte le journal et les fichiers ensemble", async () => {
    withQuota(10)
    expect((await post("QUJD")).status).toBe(201)
    expect((await putBlob(BLOB_ID, new Uint8Array(6))).status).toBe(201)
    const refused = await putBlob(OTHER_BLOB_ID, new Uint8Array(1))
    expect(refused.status).toBe(413)
    expect(await refused.json()).toEqual({ error: "Quota de stockage atteint sur ce serveur" })
    expect((await post("QUJD")).status).toBe(413)
  })

  test("un remplacement ne compte que la nouvelle taille", async () => {
    withQuota(10)
    expect((await putBlob(BLOB_ID, new Uint8Array(8))).status).toBe(201)
    expect((await putBlob(BLOB_ID, new Uint8Array(10))).status).toBe(204)
    expect((await putBlob(BLOB_ID, new Uint8Array(11))).status).toBe(413)
    expect((await putBlob(BLOB_ID, new Uint8Array(2))).status).toBe(204)
    expect((await putBlob(OTHER_BLOB_ID, new Uint8Array(8))).status).toBe(201)
  })

  test("une suppression libère le quota", async () => {
    withQuota(10)
    await putBlob(BLOB_ID, new Uint8Array(10))
    expect((await putBlob(OTHER_BLOB_ID, new Uint8Array(1))).status).toBe(413)
    await deleteBlob(BLOB_ID)
    expect((await putBlob(OTHER_BLOB_ID, new Uint8Array(10))).status).toBe(201)
  })
})

describe("routes inconnues", () => {
  test("renvoient une erreur JSON", async () => {
    const response = await api.request("/api/budgets")
    expect(response.status).toBe(404)
    expect(await response.json()).toHaveProperty("error")
  })
})
