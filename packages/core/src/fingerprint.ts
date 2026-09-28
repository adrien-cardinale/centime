export type FingerprintInput = {
  accountId: string
  bookingDate: string
  amount: number
  label: string
  occurrence?: number
}

const FNV_OFFSET_BASIS = 0xcbf29ce484222325n
const FNV_PRIME = 0x100000001b3n
const UINT64_MASK = 0xffffffffffffffffn
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const DIACRITICS_PATTERN = /\p{Diacritic}/gu
const WHITESPACE_PATTERN = /\s+/g

export function normalizeLabel(label: string): string {
  return label
    .normalize("NFKD")
    .replace(DIACRITICS_PATTERN, "")
    .toLowerCase()
    .replace(WHITESPACE_PATTERN, " ")
    .trim()
}

export function formatAmountForFingerprint(amount: number): string {
  if (!Number.isFinite(amount)) {
    throw new RangeError(`Montant invalide : ${amount}`)
  }
  const cents = Math.round(amount * 100)
  return (cents === 0 ? 0 : cents).toString()
}

export function fnv1a64(value: string): string {
  let hash = FNV_OFFSET_BASIS
  for (let index = 0; index < value.length; index++) {
    hash ^= BigInt(value.charCodeAt(index))
    hash = (hash * FNV_PRIME) & UINT64_MASK
  }
  return hash.toString(16).padStart(16, "0")
}

export function computeTransactionFingerprint(input: FingerprintInput): string {
  if (!ISO_DATE_PATTERN.test(input.bookingDate)) {
    throw new RangeError(`Date invalide : ${input.bookingDate}`)
  }
  const parts = [
    input.accountId.trim(),
    input.bookingDate,
    formatAmountForFingerprint(input.amount),
    normalizeLabel(input.label),
    String(input.occurrence ?? 0),
  ]
  return fnv1a64(parts.join("\u001f"))
}
