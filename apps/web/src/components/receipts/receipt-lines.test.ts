import { describe, expect, test } from "bun:test"
import { linesTotalGap } from "./receipt-lines"

const lines = [{ amount: 2.5 }, { amount: 10 }]

describe("écart entre les lignes et le total", () => {
  test("aucun écart quand les lignes font le total", () => {
    expect(linesTotalGap(12.5, lines)).toBeNull()
  })

  test("ignore les erreurs d'arrondi sous le centime", () => {
    expect(linesTotalGap(0.3, [{ amount: 0.1 }, { amount: 0.2 }])).toBeNull()
  })

  test("aucun écart sans lignes", () => {
    expect(linesTotalGap(12.5, [])).toBeNull()
  })

  test("aucun écart sans total valide", () => {
    expect(linesTotalGap(null, lines)).toBeNull()
  })

  test("donne l'écart en centimes quand les lignes dépassent le total", () => {
    expect(linesTotalGap(12, lines)).toEqual({ linesCents: 1250, totalCents: 1200, gapCents: 50 })
  })

  test("donne un écart négatif quand les lignes sont sous le total", () => {
    expect(linesTotalGap(15, lines)).toEqual({ linesCents: 1250, totalCents: 1500, gapCents: -250 })
  })

  test("compare au total en valeur absolue", () => {
    expect(linesTotalGap(-12.5, lines)).toBeNull()
  })
})
