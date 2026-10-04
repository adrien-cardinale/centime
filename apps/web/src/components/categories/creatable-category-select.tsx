import { Plus } from "lucide-react"
import type { ComponentProps } from "react"
import { Button } from "@/components/ui/button"
import { CategoryDialog } from "./category-dialog"
import { CategorySelect } from "./category-select"

export function CreatableCategorySelect(props: ComponentProps<typeof CategorySelect>) {
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
            aria-label="Nouvelle catégorie"
            title="Nouvelle catégorie"
            disabled={props.disabled}
          >
            <Plus />
          </Button>
        }
      />
    </div>
  )
}
