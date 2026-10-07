import { Plus } from "lucide-react"
import type { ComponentProps } from "react"
import { Button } from "@/components/ui/button"
import { CategoryDialog } from "./category-dialog"
import { CategorySelect } from "./category-select"
import { useTranslation } from "react-i18next"

export function CreatableCategorySelect(props: ComponentProps<typeof CategorySelect>) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-2">
      <CategorySelect {...props} />
      <CategoryDialog
        onSaved={props.onChange}
        trigger={
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0"
            aria-label={t("categories.newCategory")}
            title={t("categories.newCategory")}
            disabled={props.disabled}
          >
            <Plus />
          </Button>
        }
      />
    </div>
  )
}
