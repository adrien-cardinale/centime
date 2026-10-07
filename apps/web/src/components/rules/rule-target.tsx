import { useQuery } from "@tanstack/react-query"
import { Repeat } from "lucide-react"
import { CategoryBadge } from "@/components/categories/category-badge"
import { Badge } from "@/components/ui/badge"
import type { Category, Rule } from "@/lib/api"
import { fixedItemsQuery } from "@/lib/queries"
import { useTranslation } from "react-i18next"

type RuleTargetProps = {
  rule: Rule
  categoriesById: Map<string, Category>
}

export function RuleTarget({ rule, categoriesById }: RuleTargetProps) {
  const { t } = useTranslation()
  const { data: fixedItems = [] } = useQuery(fixedItemsQuery)
  const category = rule.categoryId ? categoriesById.get(rule.categoryId) : undefined
  const fixedItem = rule.fixedItemId ? fixedItems.find((item) => item.id === rule.fixedItemId) : undefined
  if (!category && !rule.markAsTransfer && !fixedItem) return <span className="text-muted-foreground">—</span>
  return (
    <div className="flex flex-wrap gap-1">
      {category && <CategoryBadge name={category.name} color={category.color} />}
      {fixedItem && (
        <Badge variant="outline">
          <Repeat />
          {fixedItem.name}
        </Badge>
      )}
      {rule.markAsTransfer && <Badge variant="secondary">{t("rules.transfer")}</Badge>}
    </div>
  )
}
