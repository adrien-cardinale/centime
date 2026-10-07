import { useQuery } from "@tanstack/react-query"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { groupCategoriesByTheme } from "@/lib/category-groups"
import { categoriesQuery, themesQuery } from "@/lib/queries"
import { cn } from "@/lib/utils"
import { ColorDot } from "./color-dot"

export type CategorySelectOption = { value: string; label: string }

type CategorySelectProps = {
  value: string | undefined
  onChange: (value: string) => void
  extraOptions?: CategorySelectOption[]
  excludeIds?: readonly string[]
  placeholder?: string
  className?: string
  id?: string
  disabled?: boolean
}

export function CategorySelect({
  value,
  onChange,
  extraOptions = [],
  excludeIds = [],
  placeholder,
  className,
  id,
  disabled,
}: CategorySelectProps) {
  const { data: categories = [] } = useQuery(categoriesQuery)
  const { data: themes = [] } = useQuery(themesQuery)
  const choices = categories.filter((category) => !excludeIds.includes(category.id))

  return (
    <Select value={value ?? ""} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id} className={cn("w-full", className)}>
        <SelectValue placeholder={placeholder ?? "Choisir une catégorie"} />
      </SelectTrigger>
      <SelectContent>
        {extraOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
        {extraOptions.length > 0 && choices.length > 0 && <SelectSeparator />}
        {groupCategoriesByTheme(choices, themes).map((group) => (
          <SelectGroup key={group.theme?.id ?? "none"}>
            {group.theme && <SelectLabel>{group.theme.name}</SelectLabel>}
            {group.categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                <ColorDot color={category.color} />
                {category.name}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}
