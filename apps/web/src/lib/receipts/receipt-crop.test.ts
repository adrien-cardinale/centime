import { describe, expect, test } from "bun:test"
import { FULL_CROP, findReceiptBounds, MIN_CROP_SIZE, moveCrop, otsuThreshold, resizeCrop } from "./receipt-crop"

const DARK = 40
const LIGHT = 220

function scene(width: number, height: number, paper: { left: number; top: number; right: number; bottom: number }) {
  const luminance = new Uint8Array(width * height).fill(DARK)
  for (let y = paper.top; y < paper.bottom; y += 1) {
    for (let x = paper.left; x < paper.right; x += 1) luminance[y * width + x] = LIGHT
  }
  return luminance
}

describe("détection du ticket", () => {
  test("seuil entre le fond et le papier", () => {
    const threshold = otsuThreshold([DARK, DARK, LIGHT, LIGHT])
    expect(threshold).toBeGreaterThan(DARK)
    expect(threshold).toBeLessThanOrEqual(LIGHT)
  })

  test("encadre le papier clair avec une marge", () => {
    const bounds = findReceiptBounds(scene(100, 100, { left: 30, top: 10, right: 70, bottom: 90 }), 100, 100)
    expect(bounds?.x).toBeCloseTo(0.28)
    expect(bounds?.y).toBeCloseTo(0.08)
    expect(bounds?.width).toBeCloseTo(0.44)
    expect(bounds?.height).toBeCloseTo(0.84)
  })

  test("ignore les petites taches claires", () => {
    const luminance = scene(100, 100, { left: 30, top: 10, right: 70, bottom: 90 })
    luminance[2 * 100 + 2] = LIGHT
    luminance[95 * 100 + 97] = LIGHT
    const bounds = findReceiptBounds(luminance, 100, 100)
    expect(bounds?.x).toBeCloseTo(0.28)
    expect(bounds?.height).toBeCloseTo(0.84)
  })

  test("renonce si le papier remplit déjà l'image", () => {
    expect(findReceiptBounds(scene(100, 100, { left: 0, top: 0, right: 100, bottom: 99 }), 100, 100)).toBeNull()
  })

  test("renonce si la zone claire est trop petite", () => {
    expect(findReceiptBounds(scene(100, 100, { left: 40, top: 40, right: 60, bottom: 60 }), 100, 100)).toBeNull()
  })

  test("renonce sans contraste", () => {
    expect(findReceiptBounds(new Uint8Array(100).fill(128), 10, 10)).toBeNull()
  })

  test("renonce si les dimensions ne correspondent pas", () => {
    expect(findReceiptBounds(new Uint8Array(10), 10, 10)).toBeNull()
  })
})

describe("manipulation du cadre", () => {
  test("le déplacement reste dans l'image", () => {
    const moved = moveCrop({ x: 0.2, y: 0.2, width: 0.5, height: 0.5 }, 0.6, -0.4)
    expect(moved).toEqual({ x: 0.5, y: 0, width: 0.5, height: 0.5 })
  })

  test("le coin haut gauche garde le coin opposé", () => {
    const resized = resizeCrop({ x: 0.2, y: 0.2, width: 0.5, height: 0.5 }, "topLeft", -0.1, 0.1)
    expect(resized.x).toBeCloseTo(0.1)
    expect(resized.y).toBeCloseTo(0.3)
    expect(resized.x + resized.width).toBeCloseTo(0.7)
    expect(resized.y + resized.height).toBeCloseTo(0.7)
  })

  test("le redimensionnement respecte la taille minimale", () => {
    const resized = resizeCrop(FULL_CROP, "bottomRight", -2, -2)
    expect(resized.width).toBeCloseTo(MIN_CROP_SIZE)
    expect(resized.height).toBeCloseTo(MIN_CROP_SIZE)
  })

  test("le redimensionnement reste dans l'image", () => {
    expect(resizeCrop(FULL_CROP, "topRight", 0.5, -0.5)).toEqual(FULL_CROP)
  })
})
