import type { CsvProfile } from "../csv-profile"

export const BANK_TEST_PROFILE: CsvProfile = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Compte de test",
  accountKind: "bank",
  encoding: "iso-8859-1",
  delimiter: ";",
  hasHeader: true,
  dateFormat: "yyyy-MM-dd HH:mm:ss.S",
  decimalSeparator: ".",
  defaultCurrency: "CHF",
  columns: {
    date: "Date comptable",
    valueDate: "Date valeur",
    label: "Libellé",
    account: "Compte",
    balance: "Solde",
  },
  amount: { mode: "signed", column: "Montant" },
  detect: { requiredHeaders: ["Compte", "Date comptable", "Libellé", "Montant"] },
}

export const CARD_TEST_PROFILE: CsvProfile = {
  id: "00000000-0000-4000-8000-000000000002",
  name: "Carte de test",
  accountKind: "card",
  encoding: "utf-8",
  delimiter: ",",
  hasHeader: true,
  dateFormat: "dd.MM.yyyy",
  decimalSeparator: ".",
  defaultCurrency: "CHF",
  columns: {
    date: "Date transaction",
    label: "Libellé",
    merchant: "Marchand",
    account: "Numéro de carte",
    currency: "Devise",
    category: "Catégorie",
    status: "Statut",
  },
  amount: { mode: "debitCredit", column: "Montant", indicatorColumn: "Sens", debitValue: "Débit" },
  statusMap: { Comptabilisée: "booked", "En attente": "pending" },
  detect: { requiredHeaders: ["Date transaction", "Numéro de carte", "Sens", "Statut"] },
}

export const TEST_CSV_PROFILES: CsvProfile[] = [BANK_TEST_PROFILE, CARD_TEST_PROFILE]
