import { describe, expect, test } from "bun:test"
import { ocrProgressRatio } from "./ocr-progress"

describe("progression de la lecture du ticket", () => {
  test("place chaque étape dans sa plage", () => {
    expect(ocrProgressRatio("loading tesseract core", 0)).toBe(0)
    expect(ocrProgressRatio("loading language traineddata", 0.5)).toBeCloseTo(0.25)
    expect(ocrProgressRatio("recognizing text", 1)).toBe(1)
  })

  test("borne les valeurs hors limites", () => {
    expect(ocrProgressRatio("recognizing text", 2)).toBe(1)
    expect(ocrProgressRatio("recognizing text", Number.NaN)).toBeCloseTo(0.45)
  })

  test("ignore les étapes inconnues", () => {
    expect(ocrProgressRatio("autre chose", 0.5)).toBeNull()
  })
})
