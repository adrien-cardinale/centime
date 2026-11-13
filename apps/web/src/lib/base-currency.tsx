import { FALLBACK_BASE_CURRENCY } from "@centime/core"
import { loadBaseCurrencyContext, saveBaseCurrency } from "@centime/services"
import { type UseMutationResult, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createContext, type ReactNode, useContext } from "react"
import { money, wholeMoney } from "@/lib/dashboard"
import { getLocalDatabase } from "@/lib/local-db/current-database"
import { BASE_CURRENCY_KEY, invalidateBudgetData } from "@/lib/queries"

const BaseCurrencyContext = createContext(FALLBACK_BASE_CURRENCY)

export function BaseCurrencyProvider({ currency, children }: { currency: string; children: ReactNode }) {
  return <BaseCurrencyContext value={currency}>{children}</BaseCurrencyContext>
}

export function useMoney() {
  const currency = useContext(BaseCurrencyContext)
  return {
    currency,
    money: (amount: number) => money(amount, currency),
    wholeMoney: (amount: number) => wholeMoney(amount, currency),
  }
}

export function useBaseCurrencySetting() {
  return useQuery({
    queryKey: BASE_CURRENCY_KEY,
    queryFn: () => getLocalDatabase().run(loadBaseCurrencyContext),
  })
}

export function useSaveBaseCurrency(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (currency: string) => getLocalDatabase().run((db) => saveBaseCurrency(db, currency)),
    onSuccess: () =>
      Promise.all([queryClient.invalidateQueries({ queryKey: BASE_CURRENCY_KEY }), invalidateBudgetData(queryClient)]),
  })
}
