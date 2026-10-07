import { categories, type Db, fixedItems, themes, transactions } from "@centime/db"
import { beforeEach, describe, expect, it } from "bun:test"
import { createTestAccount, createTestDb, insertTestTransactions, readJson, withErrorHandling } from "../test-support/database"
import { createTransactionRoutes } from "./transactions"

type Page = { items: { rawLabel: string; fixedItemId: string | null; fixedItemName: string | null }[] }

let db: Db
let accountId: string
let housing: string
let rent: string

function patch(body: unknown): RequestInit {
  return { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
}

beforeEach(async () => {
  db = await createTestDb()
  accountId = await createTestAccount(db)
  const [category] = await db.insert(categories).values({ name: "Logement", color: "#4a84c4" }).returning()
  const [item] = await db
    .insert(fixedItems)
    .values({
      name: "Loyer fictif",
      expectedAmount: -1500,
      periodicity: "monthly",
      startDate: "2026-01-01",
      categoryId: category?.id ?? null,
    })
    .returning()
  if (!category || !item) throw new Error("Données de test impossibles à créer")
  housing = category.id
  rent = item.id
})

describe("transaction routes and fixed items", () => {
  it("links transactions in bulk and inherits the item category when missing", async () => {
    const leisure = await db.insert(categories).values({ name: "Loisirs", color: "#5b9a4f" }).returning()
    const ids = await insertTestTransactions(db, accountId, [
      { rawLabel: "Loyer sans catégorie" },
      { rawLabel: "Loyer catégorisé", categoryId: leisure[0]?.id ?? null },
    ])
    const response = await withErrorHandling(createTransactionRoutes(db)).request("/", patch({ ids, fixedItemId: rent }))
    expect(await response.json()).toEqual({ updated: 2 })
    const rows = await db.select().from(transactions)
    const byLabel = new Map(rows.map((row) => [row.rawLabel, row]))
    expect(byLabel.get("Loyer sans catégorie")).toMatchObject({ fixedItemId: rent, categoryId: housing })
    expect(byLabel.get("Loyer catégorisé")).toMatchObject({ fixedItemId: rent, categoryId: leisure[0]?.id })
  })

  it("filters and exposes the fixed item", async () => {
    await insertTestTransactions(db, accountId, [{ rawLabel: "Loyer", fixedItemId: rent }, { rawLabel: "Kiosque" }])
    const linked = await withErrorHandling(createTransactionRoutes(db)).request(`/?fixedItemId=${rent}`)
    expect(await linked.json()).toMatchObject({ total: 1, items: [{ rawLabel: "Loyer", fixedItemName: "Loyer fictif" }] })
    const unlinked = await withErrorHandling(createTransactionRoutes(db)).request("/?fixedItemId=none")
    expect(await unlinked.json()).toMatchObject({ total: 1, items: [{ rawLabel: "Kiosque", fixedItemId: null }] })
  })

  it("rejects an unknown fixed item", async () => {
    const [id] = await insertTestTransactions(db, accountId, [{ rawLabel: "Loyer" }])
    const response = await withErrorHandling(createTransactionRoutes(db)).request(`/${id}`, patch({ fixedItemId: "inconnu" }))
    expect(response.status).toBe(400)
  })
})

describe("theme filter", () => {
  it("keeps every category of the theme and nothing else", async () => {
    const [theme] = await db.insert(themes).values({ name: "Maison", color: "#4a84c4" }).returning()
    const [charges] = await db.insert(categories).values({ name: "Charges", color: "#4a84c4", themeId: theme?.id ?? null }).returning()
    const [energy] = await db.insert(categories).values({ name: "Énergie", color: "#4a84c4", themeId: theme?.id ?? null }).returning()
    await insertTestTransactions(db, accountId, [
      { rawLabel: "Charges", categoryId: charges?.id ?? null },
      { rawLabel: "Énergie", categoryId: energy?.id ?? null },
      { rawLabel: "Hors thème", categoryId: housing },
      { rawLabel: "Autre" },
    ])
    const page = await readJson<Page & { total: number }>(
      await withErrorHandling(createTransactionRoutes(db)).request(`/?themeId=${theme?.id}`),
    )
    expect(page.items.map((item) => item.rawLabel).sort()).toEqual(["Charges", "Énergie"])
  })
})

describe("transaction export", () => {
  const exportRoutes = () => withErrorHandling(createTransactionRoutes(db, () => new Date(2026, 8, 27)))

  it("returns a semicolon CSV with BOM, French headers and escaped values", async () => {
    await insertTestTransactions(db, accountId, [
      { rawLabel: 'Café "Le Coin"; Lausanne', categoryId: housing, bookingDate: "2026-03-02", amount: -4.2 },
      { rawLabel: "Loyer", fixedItemId: rent, bookingDate: "2026-03-01", amount: -1500, isTransfer: true },
    ])
    const response = await exportRoutes().request("/export")
    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8")
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="transactions-2026-09-27.csv"')
    const bytes = new Uint8Array(await response.arrayBuffer())
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    const lines = new TextDecoder().decode(bytes.slice(3)).split("\r\n")
    expect(lines[0]).toBe("Date;Date valeur;Compte;Libellé;Commerçant;Montant;Devise;Statut;Catégorie;Poste fixe;Transfert")
    expect(lines[1]).toBe('2026-03-02;;Compte test;"Café ""Le Coin""; Lausanne";;-4.20;CHF;Comptabilisée;Logement;;Non')
    expect(lines[2]).toBe("2026-03-01;;Compte test;Loyer;;-1500.00;CHF;Comptabilisée;;Loyer fictif;Oui")
    expect(lines[3]).toBe("")
  })

  it("applies the list filters", async () => {
    await insertTestTransactions(db, accountId, [
      { rawLabel: "Mars", bookingDate: "2026-03-10" },
      { rawLabel: "Avril", bookingDate: "2026-04-10" },
    ])
    const response = await exportRoutes().request("/export?from=2026-04-01&to=2026-04-30")
    const lines = (await response.text()).split("\r\n").filter((line) => line !== "")
    expect(lines).toHaveLength(2)
    expect(lines[1]).toContain("Avril")
  })
})
