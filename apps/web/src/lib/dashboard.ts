import { format, parseISO } from "date-fns"
import { currentDateFnsLocale } from "@/i18n"
import { formatAmount, numberFormatter } from "./format"

export const DASHBOARD_CURRENCY = "CHF"
export const CATEGORY_LABEL_MAX_LENGTH = 18
export const CHART_HEIGHT_CLASS = "h-[240px]"
export const MOBILE_CHART_MONTHS = 6

export function visibleMonths<Point>(series: Point[], isMobile: boolean): Point[] {
  return isMobile ? series.slice(-MOBILE_CHART_MONTHS) : series
}

export function money(amount: number): string {
  return formatAmount(amount, DASHBOARD_CURRENCY)
}

export function compactAmount(amount: number): string {
  return numberFormatter({ notation: "compact", maximumFractionDigits: 1 }).format(amount)
}

export function shortMonth(isoDate: string): string {
  return format(parseISO(isoDate), "LLL", { locale: currentDateFnsLocale() })
}

export function truncateLabel(text: string, maxLength = CATEGORY_LABEL_MAX_LENGTH): string {
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text
}

export function relativeChange(current: number, previous: number): number | null {
  if (previous === 0) return null
  return (current - previous) / Math.abs(previous)
}

export function formatPercent(ratio: number): string {
  return numberFormatter({ style: "percent", maximumFractionDigits: 0 }).format(Math.abs(ratio))
}

export function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`
}

export function wholeMoney(amount: number): string {
  return numberFormatter({
    style: "currency",
    currency: DASHBOARD_CURRENCY,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}
