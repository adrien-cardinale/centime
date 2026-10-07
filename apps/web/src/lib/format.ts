import { format, parseISO } from "date-fns"
import { currentIntlLocale } from "@/i18n"

const formatterCache = new Map<string, Intl.NumberFormat>()

/** Formateur mis en cache par locale et options, pour suivre la langue courante. */
export function numberFormatter(options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const locale = currentIntlLocale()
  const cacheKey = `${locale}|${JSON.stringify(options)}`
  const cached = formatterCache.get(cacheKey)
  if (cached) return cached
  const formatter = new Intl.NumberFormat(locale, options)
  formatterCache.set(cacheKey, formatter)
  return formatter
}

export function formatAmount(amount: number, currency: string): string {
  return numberFormatter({ style: "currency", currency }).format(amount)
}

export function formatDate(isoDate: string): string {
  return format(parseISO(isoDate), "dd.MM.yyyy")
}

export function formatDateTime(isoDateTime: string): string {
  return format(parseISO(isoDateTime), "dd.MM.yyyy HH:mm")
}

export function formatDecimal(amount: number): string {
  return numberFormatter({ minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
}
