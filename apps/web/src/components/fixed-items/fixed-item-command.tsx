import { useQuery } from "@tanstack/react-query"
import { Check } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { fixedItemsQuery } from "@/lib/queries"
import { cn } from "@/lib/utils"

const NO_FIXED_ITEM = "none"

type FixedItemCommandProps = {
  selectedId?: string | null
  onSelect: (fixedItemId: string | null) => void
}

export function FixedItemCommand({ selectedId, onSelect }: FixedItemCommandProps) {
  const { t } = useTranslation()
  const { data: items = [] } = useQuery(fixedItemsQuery)
  return (
    <Command>
      <CommandInput placeholder={t("fixedItemsUi.command.search")} />
      <CommandList>
        <CommandEmpty>{t("fixedItemsUi.command.empty")}</CommandEmpty>
        <CommandGroup>
          <CommandItem value={NO_FIXED_ITEM} keywords={[t("fixedItemsUi.command.none")]} onSelect={() => onSelect(null)}>
            <span className="text-muted-foreground">{t("fixedItemsUi.command.none")}</span>
            <SelectedMark visible={selectedId === null} />
          </CommandItem>
          {items.map((item) => (
            <CommandItem key={item.id} value={item.id} keywords={[item.name]} onSelect={() => onSelect(item.id)}>
              <span className="truncate">{item.name}</span>
              <SelectedMark visible={selectedId === item.id} />
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  )
}

function SelectedMark({ visible }: { visible: boolean }) {
  return <Check className={cn("ml-auto", !visible && "invisible")} />
}
