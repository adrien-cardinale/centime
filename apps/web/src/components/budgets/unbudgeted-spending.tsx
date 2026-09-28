import { Plus } from "lucide-react"
import { CategoryBadge } from "@/components/categories/category-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { UnbudgetedCategory } from "@/lib/api"
import { BUDGET_CURRENCY } from "@/lib/budgets"
import { formatAmount } from "@/lib/format"

type UnbudgetedSpendingProps = {
  categories: UnbudgetedCategory[]
  monthLabel: string
  onCreate: (categoryId: string) => void
}

export function UnbudgetedSpending({ categories, monthLabel, onCreate }: UnbudgetedSpendingProps) {
  if (categories.length === 0) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle>Dépenses sans budget</CardTitle>
        <CardDescription>Catégories non couvertes par un budget, dépenses de {monthLabel.toLowerCase()}.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {categories.map((category) => (
            <li key={category.categoryId} className="flex items-center justify-between gap-4 py-2">
              <CategoryBadge name={category.categoryName} color={category.categoryColor} />
              <div className="flex items-center gap-3">
                <span className="text-sm tabular-nums">{formatAmount(category.spent, BUDGET_CURRENCY)}</span>
                <Button variant="outline" size="sm" onClick={() => onCreate(category.categoryId)}>
                  <Plus />
                  Créer un budget
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
