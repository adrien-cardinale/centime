import { useQuery } from "@tanstack/react-query"
import { Check, Plus } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ColorDot } from "@/components/categories/color-dot"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { groupCategoriesByTheme } from "@/lib/category-groups"
import { categoriesQuery, themesQuery } from "@/lib/queries"
import { cn } from "@/lib/utils"

const NO_CATEGORY = "none"
const NEW_CATEGORY = "new"

type CategoryCommandProps = {
  selectedId?: string | null
  onSelect: (categoryId: string | null) => void
  onCreate?: (name: string) => void
}

export function CategoryCommand({ selectedId, onSelect, onCreate }: CategoryCommandProps) {
  const { t } = useTranslation()
  const [search, setSearch] = useState("")
  const { data: categories = [] } = useQuery(categoriesQuery)
  const { data: themes = [] } = useQuery(themesQuery)

  return (
    <Command>
      <CommandInput placeholder={t("transactionsPage.category.search")} value={search} onValueChange={setSearch} />
      <CommandList>
        <CommandEmpty>{t("transactionsPage.category.notFound")}</CommandEmpty>
        <CommandGroup>
          <CommandItem value={NO_CATEGORY} keywords={[t("transactionsPage.none")]} onSelect={() => onSelect(null)}>
            <span className="text-muted-foreground">{t("transactionsPage.none")}</span>
            <SelectedMark visible={selectedId === null} />
          </CommandItem>
        </CommandGroup>
        {groupCategoriesByTheme(categories, themes).map((group) => (
          <CommandGroup key={group.theme?.id ?? "none"} heading={group.theme?.name}>
            {group.categories.map((category) => (
              <CommandItem
                key={category.id}
                value={category.id}
                keywords={[category.name, group.theme?.name ?? ""]}
                onSelect={() => onSelect(category.id)}
              >
                <ColorDot color={category.color} />
                <span className="truncate">{category.name}</span>
                <SelectedMark visible={selectedId === category.id} />
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
        {onCreate && <CreateCategoryItem name={search.trim()} onCreate={onCreate} />}
      </CommandList>
    </Command>
  )
}

function CreateCategoryItem({ name, onCreate }: { name: string; onCreate: (name: string) => void }) {
  const { t } = useTranslation()
  return (
    <>
      <CommandSeparator alwaysRender />
      <CommandGroup forceMount>
        <CommandItem forceMount value={NEW_CATEGORY} onSelect={() => onCreate(name)}>
          <Plus />
          <span className="truncate">
            {name ? t("transactionsPage.category.create", { name }) : t("transactionsPage.category.new")}
          </span>
        </CommandItem>
      </CommandGroup>
    </>
  )
}

function SelectedMark({ visible }: { visible: boolean }) {
  return <Check className={cn("ml-auto", !visible && "invisible")} />
}
