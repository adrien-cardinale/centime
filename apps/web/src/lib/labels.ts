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
import type { RowState } from "./api"

export const accountKindLabels: Record<AccountKind, string> = {
  bank: "Compte bancaire",
  card: "Carte",
}

export const transactionStatusLabels: Record<TransactionStatus, string> = {
  booked: "Comptabilisée",
  pending: "En suspens",
}

export const rowStateLabels: Record<RowState, string> = {
  new: "Nouvelle",
  duplicate: "Doublon",
  pendingToBooked: "Mise à jour",
}

export const importFormatLabels: Record<ImportFormat, string> = {
  csv: "CSV",
  camt053: "camt.053 (XML)",
}

export const csvEncodingLabels: Record<CsvEncoding, string> = {
  "utf-8": "UTF-8",
  "iso-8859-1": "ISO-8859-1 (Latin-1)",
}

export const csvDelimiterLabels: Record<CsvDelimiter, string> = {
  ";": "Point-virgule ( ; )",
  ",": "Virgule ( , )",
  "\t": "Tabulation",
}

export const decimalSeparatorLabels: Record<DecimalSeparator, string> = {
  ".": "Point ( . )",
  ",": "Virgule ( , )",
}

export const amountModeLabels: Record<CsvAmountMode, string> = {
  signed: "Montant signé",
  debitCredit: "Montant + colonne débit/crédit",
}

export const ruleMatchKindLabels: Record<RuleMatchKind, string> = {
  contains: "contient",
  regex: "regex",
}

export const ruleFieldLabels: Record<RuleField, string> = {
  raw_label: "Libellé",
  merchant: "Commerçant",
  provider_category: "Catégorie du fournisseur",
}

export const periodicityLabels: Record<Periodicity, string> = {
  monthly: "Mensuel",
  quarterly: "Trimestriel",
  yearly: "Annuel",
}

export const occurrenceStatusLabels: Record<OccurrenceStatus, string> = {
  paid: "Payé",
  upcoming: "À venir",
  due: "À échéance",
  overdue: "En retard",
}

export const budgetStateLabels: Record<BudgetState, string> = {
  ok: "Dans le budget",
  warning: "Bientôt atteint",
  exceeded: "Dépassé",
}

export const budgetPeriodGroupLabels: Record<Periodicity, string> = {
  monthly: "Mensuels",
  quarterly: "Trimestriels",
  yearly: "Annuels",
}

export const monthLabels = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
] as const

export const quarterMonthLabels = ["1er mois du trimestre", "2e mois du trimestre", "3e mois du trimestre"] as const
