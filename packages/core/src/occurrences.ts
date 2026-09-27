import { formatAmountForFingerprint, normalizeLabel } from "./fingerprint"
import type { ParsedTransaction } from "./parsed-transaction"

export type WithOccurrence<Transaction> = Transaction & { occurrence: number }

function occurrenceKey(transaction: ParsedTransaction): string {
  return [
    transaction.accountIdentifier ?? "",
    transaction.bookingDate,
    formatAmountForFingerprint(transaction.amount),
    normalizeLabel(transaction.rawLabel),
  ].join("\u001f")
}

export function assignOccurrences<Transaction extends ParsedTransaction>(
  transactions: Transaction[],
): WithOccurrence<Transaction>[] {
  const counters = new Map<string, number>()
  return transactions.map((transaction) => {
    const key = occurrenceKey(transaction)
    const occurrence = counters.get(key) ?? 0
    counters.set(key, occurrence + 1)
    return { ...transaction, occurrence }
  })
}
