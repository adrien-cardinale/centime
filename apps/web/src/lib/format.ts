import { format, parseISO } from "date-fns"

const amountFormatters = new Map<string, Intl.NumberFormat>()

function amountFormatter(currency: string): Intl.NumberFormat {
  const cached = amountFormatters.get(currency)
  if (cached) return cached
  const formatter = new Intl.NumberFormat("fr-CH", { style: "currency", currency })
  amountFormatters.set(currency, formatter)
  return formatter
}

export function formatAmount(amount: number, currency: string): string {
  return amountFormatter(currency).format(amount)
}

export function formatDate(isoDate: string): string {
  return format(parseISO(isoDate), "dd.MM.yyyy")
}

export function formatDateTime(isoDateTime: string): string {
  return format(parseISO(isoDateTime), "dd.MM.yyyy HH:mm")
}

const decimalFormatter = new Intl.NumberFormat("fr-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function formatDecimal(amount: number): string {
  return decimalFormatter.format(amount)
}
