import type {
  AccountKind,
  BudgetState,
  CsvAmountMode,
  CsvDelimiter,
  CsvEncoding,
  DecimalSeparator,
  ImportFormat,
  OccurrenceStatus,
  Periodicity,
  RuleField,
  RuleMatchKind,
  TransactionStatus,
} from "@centime/core"
import i18n, { currentIntlLocale } from "@/i18n"
import type { RowState } from "./api"

/** Dictionnaire dont chaque valeur est traduite à la lecture, dans la langue courante. */
function translatedLabels<K extends string>(prefix: string, keys: readonly K[]): Record<K, string> {
  const labels = {} as Record<K, string>
  for (const key of keys) {
    Object.defineProperty(labels, key, {
      enumerable: true,
      get: () => i18n.t(`labels.${prefix}.${key}`),
    })
  }
  return labels
}

export const accountKindLabels = translatedLabels<AccountKind>("accountKind", ["bank", "card"])

export const transactionStatusLabels = translatedLabels<TransactionStatus>("transactionStatus", ["booked", "pending"])

export const rowStateLabels = translatedLabels<RowState>("rowState", ["new", "duplicate", "pendingToBooked"])

export const importFormatLabels: Record<ImportFormat, string> = {
  csv: "CSV",
  camt053: "camt.053 (XML)",
}

export const csvEncodingLabels: Record<CsvEncoding, string> = {
  "utf-8": "UTF-8",
  "iso-8859-1": "ISO-8859-1 (Latin-1)",
}

export const csvDelimiterLabels = translatedLabels<CsvDelimiter>("csvDelimiter", [";", ",", "\t"])

export const decimalSeparatorLabels = translatedLabels<DecimalSeparator>("decimalSeparator", [".", ","])

export const amountModeLabels = translatedLabels<CsvAmountMode>("amountMode", ["signed", "debitCredit"])

export const ruleMatchKindLabels = translatedLabels<RuleMatchKind>("ruleMatchKind", ["contains", "regex"])

export const ruleFieldLabels = translatedLabels<RuleField>("ruleField", ["raw_label", "merchant", "provider_category"])

export const periodicityLabels = translatedLabels<Periodicity>("periodicity", ["monthly", "quarterly", "yearly"])

export const occurrenceStatusLabels = translatedLabels<OccurrenceStatus>("occurrenceStatus", [
  "paid",
  "upcoming",
  "due",
  "overdue",
])

export const budgetStateLabels = translatedLabels<BudgetState>("budgetState", ["ok", "warning", "exceeded"])

export const budgetPeriodGroupLabels = translatedLabels<Periodicity>("budgetPeriodGroup", [
  "monthly",
  "quarterly",
  "yearly",
])

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function getMonthLabels(): string[] {
  const formatter = new Intl.DateTimeFormat(currentIntlLocale(), { month: "long", timeZone: "UTC" })
  return Array.from({ length: 12 }, (_, month) => capitalize(formatter.format(new Date(Date.UTC(2000, month, 1)))))
}

export function getQuarterMonthLabels(): string[] {
  return [0, 1, 2].map((index) => i18n.t(`labels.quarterMonth.${index}`))
}
