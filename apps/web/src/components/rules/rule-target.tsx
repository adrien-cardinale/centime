import { CategoryBadge } from "@/components/categories/category-badge"
import { Badge } from "@/components/ui/badge"
import type { Category, Rule } from "@/lib/api"
import { useTranslation } from "react-i18next"

type RuleTargetProps = {
  rule: Rule
  categoriesById: Map<string, Category>
}

export function RuleTarget({ rule, categoriesById }: RuleTargetProps) {
  const { t } = useTranslation()
  const category = rule.categoryId ? categoriesById.get(rule.categoryId) : undefined
  if (!category && !rule.markAsTransfer) return <span className="text-muted-foreground">—</span>
  return (
    <div className="flex flex-wrap gap-1">
      {category && <CategoryBadge name={category.name} color={category.color} />}
      {rule.markAsTransfer && <Badge variant="secondary">{t("rules.transfer")}</Badge>}
    </div>
  )
}
