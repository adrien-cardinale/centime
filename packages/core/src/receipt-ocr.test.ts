import { describe, expect, it } from "bun:test"
import { parseReceiptText } from "./receipt-ocr"

const coopTicket = `
Coop
Coop Pronto Lausanne Gare
Place de la Gare 9
1003 Lausanne
Tel. 021 123 45 67
CHE-116.320.360 MWST
Lait entier 1l          1.85 A
Pain mi-blanc           2.90 A
Gruyère AOP             6.40 A
Coca-Cola 0.5l          2.20 B
TOTAL CHF              13.35
Visa                   13.35
MWST  A 2.6%   11.15    0.29
      B 8.1%    2.20    0.16
12.03.2026 17:42  Kasse 3
`

const migrosTicket = `
MIGROS
Genossenschaft Migros Zürich
M Zürich Limmatplatz
Limmatstrasse 152, 8005 Zürich
Bananen Max Havelaar
  2 x 1.95              3.90
Vollmilch UHT 1L        1.60
Rabais Aktion          -0.80
Brot Zopf 500g          3.40
Rabais                  0.50-
Zwischensumme           7.60
TOTAL                   7.60
TWINT                   7.60
Quittung 05/03/2026 08:15
Cumulus-Punkte 7
`

const restaurantTicket = `
Café du Marché
Rue de Bourg 5
1003 Lausanne
www.cafedumarche.ch
Table 4        Serveur: Julie
Date: 21.09.2026 12:47
2 Menu du jour          46.00
1 Eau minérale 50cl      4.50
2 Café                   9.00
Total                   59.50
TVA 8.1% incl.           4.45
À PAYER CHF             59.50
TWINT                   59.50
Merci de votre visite
`

const frenchSupermarketTicket = `
CARREFOUR MARKET
12 AVENUE JEAN JAURES
74100 ANNEMASSE
TEL 04 50 12 34 56
BAGUETTE TRADITION       1,10 €
YAOURT NATURE X4         2,35 €
POULET ROTI              8,90 €
EAU MINERALE 6X1,5L      3,12 €
SOUS-TOTAL              15,47 €
TOTAL TTC               15,47 EUR
CARTE BANCAIRE          15,47 EUR
TVA 5,5%                 0,81
08/10/2026  18:32:05
`

const degradedTicket = `
DENNER AG
Fi1iale 412 Bern
Kaffee Bohnen 1kg       l2.9O A
Wein Rioja 75cl          7.6O B
TOTAL CHF               2O.5O
03.04.26 14:10
`

const thousandsTicket = `
IKEA AG
Filiale Aubonne
Sofa KIVIK 3-places    1'199.00
Lampe NOT                35.50
TOTAL CHF            1'234.50
Date 2026-09-30
`

const ticketWithoutTotalKeyword = `
Boulangerie Dupont
Croissant          1.80
Pain complet       4.20
Tarte aux pommes   5.50
                  11.50
Merci
`

const ticketWithUnreadableItem = `
Kiosque de la Gare
Journal 24 heures   3.50
Chewing-gum         2.00
#### ### ##
                    9.00
`

const now = new Date(2026, 9, 10, 12, 0, 0)

describe("parseReceiptText", () => {
  it("reads a Coop ticket with VAT letter codes", () => {
    const result = parseReceiptText(coopTicket, { now })

    expect(result.merchant).toBe("Coop")
    expect(result.total).toBe(13.35)
    expect(result.receiptDate).toBe("2026-03-12")
    expect(result.lines).toEqual([
      { label: "Lait entier 1l", amount: 1.85 },
      { label: "Pain mi-blanc", amount: 2.9 },
      { label: "Gruyère AOP", amount: 6.4 },
      { label: "Coca-Cola 0.5l", amount: 2.2 },
    ])
    expect(result.confidence.total).toBeGreaterThanOrEqual(0.9)
  })

  it("reads a Migros ticket with quantities and discounts", () => {
    const result = parseReceiptText(migrosTicket, { now })

    expect(result.merchant).toBe("Migros")
    expect(result.total).toBe(7.6)
    expect(result.receiptDate).toBe("2026-03-05")
    expect(result.lines).toEqual([
      { label: "Bananen Max Havelaar", amount: 3.9 },
      { label: "Vollmilch UHT 1L", amount: 1.6 },
      { label: "Rabais Aktion", amount: -0.8 },
      { label: "Brot Zopf 500g", amount: 3.4 },
      { label: "Rabais", amount: -0.5 },
    ])
  })

  it("reads a restaurant bill paid with TWINT", () => {
    const result = parseReceiptText(restaurantTicket, { now })

    expect(result.merchant).toBe("Café du Marché")
    expect(result.total).toBe(59.5)
    expect(result.receiptDate).toBe("2026-09-21")
    expect(result.lines).toEqual([
      { label: "Menu du jour", amount: 46 },
      { label: "Eau minérale 50cl", amount: 4.5 },
      { label: "Café", amount: 9 },
    ])
  })

  it("reads a French supermarket ticket with comma decimals", () => {
    const result = parseReceiptText(frenchSupermarketTicket, { now })

    expect(result.merchant).toBe("CARREFOUR MARKET")
    expect(result.total).toBe(15.47)
    expect(result.receiptDate).toBe("2026-10-08")
    expect(result.lines.map((line) => line.amount)).toEqual([1.1, 2.35, 8.9, 3.12])
    expect(result.lines[3]?.label).toBe("EAU MINERALE 6X1,5L")
  })

  it("repairs OCR digit confusions", () => {
    const result = parseReceiptText(degradedTicket, { now })

    expect(result.merchant).toBe("Denner")
    expect(result.total).toBe(20.5)
    expect(result.receiptDate).toBe("2026-04-03")
    expect(result.lines).toEqual([
      { label: "Kaffee Bohnen 1kg", amount: 12.9 },
      { label: "Wein Rioja 75cl", amount: 7.6 },
    ])
    expect(result.confidence.receiptDate).toBeLessThan(0.9)
  })

  it("removes apostrophe thousands separators", () => {
    const result = parseReceiptText(thousandsTicket, { now })

    expect(result.merchant).toBe("IKEA")
    expect(result.total).toBe(1234.5)
    expect(result.receiptDate).toBe("2026-09-30")
    expect(result.lines.map((line) => line.amount)).toEqual([1199, 35.5])
  })

  it("falls back on the sum of the lines when no total keyword exists", () => {
    const result = parseReceiptText(ticketWithoutTotalKeyword, { now })
    const keywordResult = parseReceiptText(coopTicket, { now })

    expect(result.merchant).toBe("Boulangerie Dupont")
    expect(result.total).toBe(11.5)
    expect(result.receiptDate).toBeNull()
    expect(result.lines).toHaveLength(3)
    expect(result.confidence.total).toBeLessThan(keywordResult.confidence.total)
  })

  it("falls back on the largest amount of the lower half", () => {
    const result = parseReceiptText(ticketWithUnreadableItem, { now })
    const sumResult = parseReceiptText(ticketWithoutTotalKeyword, { now })

    expect(result.total).toBe(9)
    expect(result.lines.map((line) => line.amount)).toEqual([3.5, 2])
    expect(result.confidence.total).toBeLessThan(sumResult.confidence.total)
  })

  it("skips impossible, future and too old dates", () => {
    const text = "Shop Test\n30.02.2026\n31.12.2030\n01.01.2001\n05.10.2026 09:00\nTOTAL 4.00"

    expect(parseReceiptText(text, { now }).receiptDate).toBe("2026-10-05")
  })

  it("accepts a date of tomorrow but not later", () => {
    expect(parseReceiptText("Shop Test\n11.10.2026", { now }).receiptDate).toBe("2026-10-11")
    expect(parseReceiptText("Shop Test\n12.10.2026", { now }).receiptDate).toBeNull()
  })

  it("returns empty fields on garbage input", () => {
    const empty = {
      merchant: null,
      total: null,
      receiptDate: null,
      lines: [],
      confidence: { merchant: 0, total: 0, receiptDate: 0 },
    }

    expect(parseReceiptText("", { now })).toEqual(empty)
    expect(parseReceiptText("   \n\n \t ", { now })).toEqual(empty)
    expect(parseReceiptText("#@! ~~ 1 2\n%%% ::\n|||| __ 0", { now })).toEqual(empty)
    expect(parseReceiptText(null as unknown as string, { now })).toEqual(empty)
  })
})
