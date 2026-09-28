import type { CsvProfile } from "./csv-profile"

export const RAIFFEISEN_PROFILE_ID = "5b0c1f3e-8a2d-4e61-9c7b-2d4f6a8e1c01"
export const SWISSCARD_PROFILE_ID = "5b0c1f3e-8a2d-4e61-9c7b-2d4f6a8e1c02"

export const RAIFFEISEN_CSV_PROFILE: CsvProfile = {
  id: RAIFFEISEN_PROFILE_ID,
  name: "Raiffeisen",
  accountKind: "bank",
  encoding: "iso-8859-1",
  delimiter: ";",
  hasHeader: true,
  dateFormat: "yyyy-MM-dd HH:mm:ss.S",
  decimalSeparator: ".",
  defaultCurrency: "CHF",
  columns: {
    date: "Booked At",
    valueDate: "Valuta Date",
    label: "Text",
    account: "IBAN",
    balance: "Balance",
  },
  amount: { mode: "signed", column: "Credit/Debit Amount" },
  detect: { requiredHeaders: ["IBAN", "Booked At", "Text", "Credit/Debit Amount"] },
}

export const SWISSCARD_CSV_PROFILE: CsvProfile = {
  id: SWISSCARD_PROFILE_ID,
  name: "Swisscard",
  accountKind: "card",
  encoding: "utf-8",
  delimiter: ",",
  hasHeader: true,
  dateFormat: "dd.MM.yyyy",
  decimalSeparator: ".",
  defaultCurrency: "CHF",
  columns: {
    date: "Date transaction",
    label: "Description",
    merchant: "Commerçant",
    account: "Numéro de carte",
    currency: "Monnaie",
    category: "Catégorie de commerçant",
    status: "Statut",
  },
  amount: { mode: "debitCredit", column: "Montant", indicatorColumn: "Débit/Crédit", debitValue: "Débit" },
  statusMap: { Comptabilisée: "booked", "En suspens": "pending" },
  detect: { requiredHeaders: ["Date transaction", "Numéro de carte", "Débit/Crédit", "Statut"] },
}

export const DEFAULT_CSV_PROFILES: CsvProfile[] = [RAIFFEISEN_CSV_PROFILE, SWISSCARD_CSV_PROFILE]
