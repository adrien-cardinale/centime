import type { Category, Theme } from "@/lib/api"

export type CategoryGroup = { theme: Theme | null; categories: Category[] }

export function groupCategoriesByTheme(categories: readonly Category[], themes: readonly Theme[]): CategoryGroup[] {
  const themed = themes
    .map((theme) => ({ theme, categories: categories.filter((category) => category.themeId === theme.id) }))
    .filter((group) => group.categories.length > 0)
  const known = new Set(themes.map((theme) => theme.id))
  const loose = categories.filter((category) => category.themeId === null || !known.has(category.themeId))
  return [...themed, ...(loose.length > 0 ? [{ theme: null, categories: loose }] : [])]
}
