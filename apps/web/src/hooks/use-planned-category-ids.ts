import { useQuery } from "@tanstack/react-query"
import { budgetsQuery } from "@/lib/queries"

export function usePlannedCategoryIds(keptCategoryId?: string): string[] {
  const { data: budgets = [] } = useQuery(budgetsQuery)
  return budgets.map((budget) => budget.categoryId).filter((categoryId) => categoryId !== keptCategoryId)
}
