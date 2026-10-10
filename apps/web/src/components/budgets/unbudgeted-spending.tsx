import { Plus } from "lucide-react"
import { useTranslation } from "react-i18next"
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
  const { t } = useTranslation()
  if (categories.length === 0) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("budgets.unbudgeted.title")}</CardTitle>
        <CardDescription>{t("budgets.unbudgeted.description", { month: monthLabel.toLowerCase() })}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {categories.map((category) => (
            <li key={category.categoryId} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <CategoryBadge name={category.categoryName} color={category.categoryColor} className="min-w-0 shrink" />
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="text-sm whitespace-nowrap tabular-nums">{formatAmount(category.spent, BUDGET_CURRENCY)}</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="min-w-10"
                  aria-label={t("budgets.unbudgeted.createFor", { name: category.categoryName })}
                  onClick={() => onCreate(category.categoryId)}
                >
                  <Plus />
                  <span className="sr-only sm:not-sr-only">{t("budgets.unbudgeted.create")}</span>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
