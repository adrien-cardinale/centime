import { useQuery } from "@tanstack/react-query"
import { Check } from "lucide-react"
import { useState } from "react"
import { CategoryBadge } from "@/components/categories/category-badge"
import { ColorDot } from "@/components/categories/color-dot"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useUpdateTransaction } from "@/hooks/use-transaction-updates"
import type { TransactionItem } from "@/lib/api"
import { categoriesQuery } from "@/lib/queries"
import { cn } from "@/lib/utils"

const NO_CATEGORY = "none"

export function CategoryCell({ transaction }: { transaction: TransactionItem }) {
  const [open, setOpen] = useState(false)
  const { data: categories = [] } = useQuery(categoriesQuery)
  const update = useUpdateTransaction()

  const choose = (categoryId: string | null) => {
    setOpen(false)
    if (categoryId === transaction.categoryId) return
    update.mutate({ id: transaction.id, changes: { categoryId } })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={update.isPending}
          aria-label="Changer la catégorie"
          className="rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50"
        >
          <CurrentCategory transaction={transaction} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Rechercher une catégorie…" />
          <CommandList>
            <CommandEmpty>Aucune catégorie trouvée.</CommandEmpty>
            <CommandGroup>
              <CommandItem value={NO_CATEGORY} keywords={["Aucune"]} onSelect={() => choose(null)}>
                <span className="text-muted-foreground">Aucune</span>
                <SelectedMark visible={transaction.categoryId === null} />
              </CommandItem>
              {categories.map((category) => (
                <CommandItem
                  key={category.id}
                  value={category.id}
                  keywords={[category.name]}
                  onSelect={() => choose(category.id)}
                >
                  <ColorDot color={category.color} />
                  <span className="truncate">{category.name}</span>
                  <SelectedMark visible={transaction.categoryId === category.id} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function CurrentCategory({ transaction }: { transaction: TransactionItem }) {
  if (transaction.categoryName && transaction.categoryColor) {
    return <CategoryBadge name={transaction.categoryName} color={transaction.categoryColor} className="cursor-pointer" />
  }
  return <span className="cursor-pointer px-2 text-muted-foreground hover:text-foreground">—</span>
}

function SelectedMark({ visible }: { visible: boolean }) {
  return <Check className={cn("ml-auto", !visible && "invisible")} />
}
