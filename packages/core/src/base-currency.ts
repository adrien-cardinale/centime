import { isCurrencyCode } from "./csv-values"

export const FALLBACK_BASE_CURRENCY = "CHF"

function countByCurrency(accountCurrencies: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const currency of accountCurrencies) counts.set(currency, (counts.get(currency) ?? 0) + 1)
  return counts
}

export function majorityCurrency(accountCurrencies: readonly string[]): string | null {
  const ranked = [...countByCurrency(accountCurrencies)].sort(
    ([leftCode, leftCount], [rightCode, rightCount]) => rightCount - leftCount || leftCode.localeCompare(rightCode),
  )
  return ranked[0]?.[0] ?? null
}

export function normalizeCurrencyCode(value: string): string | null {
  const trimmed = value.trim()
  return isCurrencyCode(trimmed) ? trimmed.toUpperCase() : null
}

export function resolveBaseCurrency(stored: string | undefined, accountCurrencies: readonly string[]): string {
  const preferred = stored === undefined ? null : normalizeCurrencyCode(stored)
  return preferred ?? majorityCurrency(accountCurrencies) ?? FALLBACK_BASE_CURRENCY
}

export function baseCurrencyOptions(accountCurrencies: readonly string[], current: string): string[] {
  return [...new Set([...accountCurrencies, current])].sort((left, right) => left.localeCompare(right))
}

export function countOtherCurrencyAccounts(accountCurrencies: readonly string[], base: string): number {
  return accountCurrencies.filter((currency) => currency !== base).length
}
