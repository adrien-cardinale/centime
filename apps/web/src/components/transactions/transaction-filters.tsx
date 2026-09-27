import { useQuery } from "@tanstack/react-query"
import { Search } from "lucide-react"
import type { ReactNode } from "react"
import { AccountSelect } from "@/components/accounts/account-select"
import { CategorySelect } from "@/components/categories/category-select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select"
import { type TransferFilter, UNCATEGORIZED_FILTER, WITHOUT_FIXED_ITEM_FILTER } from "@/lib/api"
import { fixedItemsQuery } from "@/lib/queries"

export type TransactionFilterValues = {
  accountId: string | undefined
  from: string
  to: string
  search: string
  categoryId: string | undefined
  fixedItemId: string | undefined
  transfer: TransferFilter | undefined
}

type TransactionFiltersProps = {
  values: TransactionFilterValues
  onChange: (values: TransactionFilterValues) => void
  includeChildren?: boolean
  actions?: ReactNode
}

const ALL = "all"

const transferOptions: Record<TransferFilter | typeof ALL, string> = {
  all: "Toutes",
  hide: "Masquer les transferts",
  only: "Transferts uniquement",
}

function toTransferFilter(value: string): TransferFilter | undefined {
  return value === "hide" || value === "only" ? value : undefined
}

export function TransactionFilters({ values, onChange, includeChildren = false, actions }: TransactionFiltersProps) {
  const update = (patch: Partial<TransactionFilterValues>) => onChange({ ...values, ...patch })

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div className="space-y-2">
        <Label htmlFor="filter-account">Compte</Label>
        <AccountSelect id="filter-account" allowAll value={values.accountId} onChange={(accountId) => update({ accountId })} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="filter-from">Du</Label>
        <Input id="filter-from" type="date" value={values.from} onChange={(event) => update({ from: event.target.value })} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="filter-to">Au</Label>
        <Input id="filter-to" type="date" value={values.to} onChange={(event) => update({ to: event.target.value })} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="filter-search">Recherche</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="filter-search"
            type="search"
            placeholder="Libellé ou commerçant"
            className="pl-8"
            value={values.search}
            onChange={(event) => update({ search: event.target.value })}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="filter-category">Catégorie</Label>
        <CategorySelect
          id="filter-category"
          value={values.categoryId ?? ALL}
          onChange={(value) => update({ categoryId: value === ALL ? undefined : value })}
          extraOptions={[
            { value: ALL, label: "Toutes" },
            { value: UNCATEGORIZED_FILTER, label: "Non catégorisées" },
          ]}
        />
        {includeChildren && <p className="text-xs text-muted-foreground">Sous-catégories incluses</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="filter-fixed-item">Poste fixe</Label>
        <FixedItemFilter value={values.fixedItemId} onChange={(fixedItemId) => update({ fixedItemId })} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="filter-transfer">Transferts</Label>
        <Select value={values.transfer ?? ALL} onValueChange={(value) => update({ transfer: toTransferFilter(value) })}>
          <SelectTrigger id="filter-transfer" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(transferOptions).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {actions && <div className="flex items-end justify-end gap-2">{actions}</div>}
    </div>
  )
}

function FixedItemFilter({ value, onChange }: { value: string | undefined; onChange: (value: string | undefined) => void }) {
  const { data: items = [] } = useQuery(fixedItemsQuery)
  return (
    <Select value={value ?? ALL} onValueChange={(next) => onChange(next === ALL ? undefined : next)}>
      <SelectTrigger id="filter-fixed-item" className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>Tous</SelectItem>
        <SelectItem value={WITHOUT_FIXED_ITEM_FILTER}>Sans poste</SelectItem>
        {items.length > 0 && <SelectSeparator />}
        {items.map((item) => (
          <SelectItem key={item.id} value={item.id}>
            {item.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
