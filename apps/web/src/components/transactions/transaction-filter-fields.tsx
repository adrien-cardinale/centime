import { useQuery } from "@tanstack/react-query"
import { Search } from "lucide-react"
import { useTranslation } from "react-i18next"
import { AccountSelect } from "@/components/accounts/account-select"
import { CategorySelect } from "@/components/categories/category-select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select"
import { type TransferFilter, UNCATEGORIZED_FILTER, WITHOUT_FIXED_ITEM_FILTER } from "@/lib/api"
import i18n from "@/i18n"
import { fixedItemsQuery, themesQuery } from "@/lib/queries"

export type TransactionFilterValues = {
  accountId: string | undefined
  from: string
  to: string
  search: string
  categoryId: string | undefined
  themeId: string | undefined
  fixedItemId: string | undefined
  transfer: TransferFilter | undefined
}

export type TransactionFilterFieldsProps = {
  values: TransactionFilterValues
  onChange: (values: TransactionFilterValues) => void
}

const ALL = "all"
const THEME_PREFIX = "theme:"

export const NO_FILTERS: TransactionFilterValues = {
  accountId: undefined,
  from: "",
  to: "",
  search: "",
  categoryId: undefined,
  themeId: undefined,
  fixedItemId: undefined,
  transfer: undefined,
}

function transferOptions(): Record<TransferFilter | typeof ALL, string> {
  return {
    all: i18n.t("transactionsPage.filters.all"),
    hide: i18n.t("transactionsPage.filters.hideTransfers"),
    only: i18n.t("transactionsPage.filters.onlyTransfers"),
  }
}

function toTransferFilter(value: string): TransferFilter | undefined {
  return value === "hide" || value === "only" ? value : undefined
}

export function activeFilterCount(values: TransactionFilterValues): number {
  const active = [
    values.accountId,
    values.from,
    values.to,
    values.search.trim(),
    values.categoryId ?? values.themeId,
    values.fixedItemId,
    values.transfer,
  ]
  return active.filter(Boolean).length
}

export function TransactionFilterFields({ values, onChange }: TransactionFilterFieldsProps) {
  const { t } = useTranslation()
  const { data: themes = [] } = useQuery(themesQuery)
  const update = (patch: Partial<TransactionFilterValues>) => onChange({ ...values, ...patch })
  const categoryValue = values.themeId ? `${THEME_PREFIX}${values.themeId}` : (values.categoryId ?? ALL)
  const changeCategory = (value: string) => {
    if (value.startsWith(THEME_PREFIX)) update({ themeId: value.slice(THEME_PREFIX.length), categoryId: undefined })
    else update({ categoryId: value === ALL ? undefined : value, themeId: undefined })
  }

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="filter-account">{t("transactionsPage.columns.account")}</Label>
        <AccountSelect id="filter-account" allowAll value={values.accountId} onChange={(accountId) => update({ accountId })} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="filter-from">{t("transactionsPage.filters.from")}</Label>
        <Input id="filter-from" type="date" value={values.from} onChange={(event) => update({ from: event.target.value })} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="filter-to">{t("transactionsPage.filters.to")}</Label>
        <Input id="filter-to" type="date" value={values.to} onChange={(event) => update({ to: event.target.value })} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="filter-search">{t("transactionsPage.filters.search")}</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="filter-search"
            type="search"
            placeholder={t("transactionsPage.filters.searchPlaceholder")}
            className="pl-8"
            value={values.search}
            onChange={(event) => update({ search: event.target.value })}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="filter-category">{t("transactionsPage.columns.category")}</Label>
        <CategorySelect
          id="filter-category"
          value={categoryValue}
          onChange={changeCategory}
          extraOptions={[
            { value: ALL, label: t("transactionsPage.filters.all") },
            { value: UNCATEGORIZED_FILTER, label: t("transactionsPage.filters.uncategorized") },
            ...themes.map((theme) => ({ value: `${THEME_PREFIX}${theme.id}`, label: t("transactionsPage.filters.theme", { name: theme.name }) })),
          ]}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="filter-fixed-item">{t("transactionsPage.columns.fixedItem")}</Label>
        <FixedItemFilter value={values.fixedItemId} onChange={(fixedItemId) => update({ fixedItemId })} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="filter-transfer">{t("transactionsPage.filters.transfers")}</Label>
        <Select value={values.transfer ?? ALL} onValueChange={(value) => update({ transfer: toTransferFilter(value) })}>
          <SelectTrigger id="filter-transfer" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(transferOptions()).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  )
}

function FixedItemFilter({ value, onChange }: { value: string | undefined; onChange: (value: string | undefined) => void }) {
  const { t } = useTranslation()
  const { data: items = [] } = useQuery(fixedItemsQuery)
  return (
    <Select value={value ?? ALL} onValueChange={(next) => onChange(next === ALL ? undefined : next)}>
      <SelectTrigger id="filter-fixed-item" className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{t("transactionsPage.filters.allFixedItems")}</SelectItem>
        <SelectItem value={WITHOUT_FIXED_ITEM_FILTER}>{t("transactionsPage.filters.withoutFixedItem")}</SelectItem>
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
