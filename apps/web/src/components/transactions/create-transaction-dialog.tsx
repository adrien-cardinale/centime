import { type ManualTransaction, manualTransactionSchema } from "@centime/core"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import type { z } from "zod"
import { AccountSelect } from "@/components/accounts/account-select"
import { CategorySelect } from "@/components/categories/category-select"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { api, type Account } from "@/lib/api"
import { todayIso } from "@/lib/budgets"
import { parseAmountInput } from "@/lib/format"
import { accountsQuery, invalidateTransactionData } from "@/lib/queries"

type TransactionFormValues = z.input<typeof manualTransactionSchema>

const NO_CATEGORY = "none"
const DIRECTIONS = ["expense", "income"] as const
type Direction = (typeof DIRECTIONS)[number]

function soleAccountId(accounts: Account[]): string {
  return accounts.length === 1 ? (accounts[0]?.id ?? "") : ""
}

function defaultValues(accountId: string): TransactionFormValues {
  return { accountId, bookingDate: todayIso(), rawLabel: "", merchant: "", amount: Number.NaN, categoryId: null }
}

function signedAmount(text: string, direction: Direction): number {
  const amount = parseAmountInput(text)
  if (amount === null) return Number.NaN
  return direction === "expense" ? -Math.abs(amount) : Math.abs(amount)
}

export function CreateTransactionDialog() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          {t("transactionsPage.create.new")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("transactionsPage.create.new")}</DialogTitle>
          <DialogDescription>{t("transactionsPage.create.description")}</DialogDescription>
        </DialogHeader>
        <CreateTransactionForm onCreated={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

function CreateTransactionForm({ onCreated }: { onCreated: () => void }) {
  const { t } = useTranslation()
  const [amountText, setAmountText] = useState("")
  const [direction, setDirection] = useState<Direction>("expense")
  const queryClient = useQueryClient()
  const { data: accounts = [] } = useQuery(accountsQuery)
  const form = useForm<TransactionFormValues, unknown, ManualTransaction>({
    resolver: zodResolver(manualTransactionSchema),
    defaultValues: defaultValues(soleAccountId(accounts)),
  })

  const create = useMutation({
    mutationFn: (input: ManualTransaction) => api.transactions.create(input),
    onSuccess: async (created) => {
      await invalidateTransactionData(queryClient)
      toast.success(t("transactionsPage.create.created", { label: created.rawLabel }))
      onCreated()
    },
    onError: (error) => toast.error(error.message),
  })

  function updateAmount(text: string, nextDirection: Direction) {
    setAmountText(text)
    setDirection(nextDirection)
    form.setValue("amount", signedAmount(text, nextDirection), { shouldValidate: form.formState.isSubmitted })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((input) => create.mutate(input))} className="space-y-5">
        <FormField
          control={form.control}
          name="accountId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("transactionsPage.create.account")}</FormLabel>
              <FormControl>
                <AccountSelect value={field.value || undefined} onChange={(accountId) => field.onChange(accountId ?? "")} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <DirectionToggle value={direction} onChange={(next) => updateAmount(amountText, next)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="amount"
            render={() => (
              <FormItem>
                <FormLabel>{t("transactionsPage.create.amount")}</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder={t("transactionsPage.create.amountPlaceholder")}
                    value={amountText}
                    onChange={(event) => updateAmount(event.target.value, direction)}
                  />
                </FormControl>
                <FormDescription>{t("transactionsPage.create.amountHint")}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="bookingDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("transactionsPage.create.date")}</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="rawLabel"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("transactionsPage.create.label")}</FormLabel>
              <FormControl>
                <Input placeholder={t("transactionsPage.create.labelPlaceholder")} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="merchant"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("transactionsPage.create.merchant")}</FormLabel>
              <FormControl>
                <Input placeholder={t("transactionsPage.create.merchantPlaceholder")} {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="categoryId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("transactionsPage.create.category")}</FormLabel>
              <FormControl>
                <CategorySelect
                  value={field.value ?? NO_CATEGORY}
                  onChange={(categoryId) => field.onChange(categoryId === NO_CATEGORY ? null : categoryId)}
                  extraOptions={[{ value: NO_CATEGORY, label: t("transactionsPage.none") }]}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <DialogFooter>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? t("transactionsPage.create.creating") : t("transactionsPage.create.create")}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  )
}

function DirectionToggle({ value, onChange }: { value: Direction; onChange: (value: Direction) => void }) {
  const { t } = useTranslation()
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      aria-label={t("transactionsPage.create.direction")}
      value={value}
      onValueChange={(next) => next !== "" && onChange(next as Direction)}
      className="w-full"
    >
      {DIRECTIONS.map((direction) => (
        <ToggleGroupItem key={direction} value={direction} className="flex-1">
          {t(`transactionsPage.create.${direction}`)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
