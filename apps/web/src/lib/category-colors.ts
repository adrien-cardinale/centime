export const CATEGORY_COLOR_PALETTE = [
  "#5b9a4f",
  "#3f9a6e",
  "#3a9e9b",
  "#4a84c4",
  "#3f6fae",
  "#6f78cc",
  "#8067b7",
  "#c46a9e",
  "#cc6666",
  "#d08a3e",
  "#c9a23a",
  "#7c8490",
] as const

export const DEFAULT_CATEGORY_COLOR = CATEGORY_COLOR_PALETTE[3]

export function tintedBackground(color: string): string {
  return `${color}1f`
}

export function tintedBorder(color: string): string {
  return `${color}59`
}
