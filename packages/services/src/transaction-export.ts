import { encodeCsv, type CsvCell, type IsoDate, type TransactionStatus } from "@centime/core"
import type { DbExecutor } from "@centime/db"
import type { SQL } from "drizzle-orm"
import { type Clock, systemClock, todayOf } from "./clock"
import { listTransactions, type TransactionFilter, transactionCondition, type TransactionListItem } from "./transactions"

export const MAX_EXPORT_ROWS = 50_000
export const CSV_CONTENT_TYPE = "text/csv; charset=utf-8"

const DELIMITER = ";"
const BYTE_ORDER_MARK = "﻿"

const HEADERS = [
  "Date",
  "Date valeur",
  "Compte",
  "Libellé",
  "Commerçant",
  "Montant",
  "Devise",
  "Statut",
  "Catégorie",
  "Poste fixe",
  "Transfert",
]

const STATUS_LABELS: Record<TransactionStatus, string> = {
  booked: "Comptabilisée",
  pending: "En suspens",
}

function toCells(item: TransactionListItem): CsvCell[] {
  return [
    item.bookingDate,
    item.valueDate,
    item.accountName,
    item.rawLabel,
    item.merchant,
    item.amount.toFixed(2),
    item.currency,
    STATUS_LABELS[item.status],
    item.categoryName,
    item.fixedItemName,
    item.isTransfer ? "Oui" : "Non",
  ]
}

export async function exportTransactionsCsv(db: DbExecutor, condition: SQL | undefined): Promise<string> {
  const items = await listTransactions(db, condition, { limit: MAX_EXPORT_ROWS, offset: 0 })
  return BYTE_ORDER_MARK + encodeCsv([HEADERS, ...items.map(toCells)], DELIMITER)
}

export function exportFileName(today: IsoDate): string {
  return `transactions-${today}.csv`
}

export type TransactionExport = { fileName: string; contentType: string; content: string }

export async function exportTransactions(
  db: DbExecutor,
  filter: TransactionFilter,
  clock: Clock = systemClock,
): Promise<TransactionExport> {
  const content = await exportTransactionsCsv(db, await transactionCondition(db, filter))
  return { fileName: exportFileName(todayOf(clock)), contentType: CSV_CONTENT_TYPE, content }
}
