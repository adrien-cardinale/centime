import { CATEGORY_COLOR_PALETTE } from "@centime/core"

export function pickLeastUsedColor(palette: readonly string[], usedColors: readonly string[]): string {
  const usage = new Map(palette.map((color) => [color.toLowerCase(), 0]))
  for (const color of usedColors) {
    const key = color.toLowerCase()
    const count = usage.get(key)
    if (count !== undefined) usage.set(key, count + 1)
  }
  let chosen: string | undefined
  let lowest = Number.POSITIVE_INFINITY
  for (const color of palette) {
    const count = usage.get(color.toLowerCase()) ?? 0
    if (count < lowest) {
      chosen = color
      lowest = count
    }
  }
  if (chosen === undefined) throw new Error("La palette de couleurs est vide")
  return chosen
}

export function pickCategoryPaletteColor(usedColors: readonly string[]): string {
  return pickLeastUsedColor(CATEGORY_COLOR_PALETTE, usedColors)
}
