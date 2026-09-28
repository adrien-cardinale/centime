import { format, parseISO } from "date-fns"
import { fr } from "date-fns/locale"
import { formatAmount } from "./format"

export const DASHBOARD_CURRENCY = "CHF"
export const CATEGORY_LABEL_MAX_LENGTH = 18
export const CHART_HEIGHT_CLASS = "h-[240px]"

const compactFormatter = new Intl.NumberFormat("fr-CH", { notation: "compact", maximumFractionDigits: 1 })
const percentFormatter = new Intl.NumberFormat("fr-CH", { style: "percent", maximumFractionDigits: 0 })

export function money(amount: number): string {
  return formatAmount(amount, DASHBOARD_CURRENCY)
}

export function compactAmount(amount: number): string {
  return compactFormatter.format(amount)
}

export function shortMonth(isoDate: string): string {
  return format(parseISO(isoDate), "LLL", { locale: fr })
}

export function truncateLabel(text: string, maxLength = CATEGORY_LABEL_MAX_LENGTH): string {
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text
}

export function relativeChange(current: number, previous: number): number | null {
  if (previous === 0) return null
  return (current - previous) / Math.abs(previous)
}

export function formatPercent(ratio: number): string {
  return percentFormatter.format(Math.abs(ratio))
}

export function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`
}

const wholeAmountFormatter = new Intl.NumberFormat("fr-CH", {
  style: "currency",
  currency: DASHBOARD_CURRENCY,
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

export function wholeMoney(amount: number): string {
  return wholeAmountFormatter.format(amount)
}
