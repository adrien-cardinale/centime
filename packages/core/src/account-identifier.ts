const IBAN_PATTERN = /^[A-Z]{2}\d{2}[A-Z0-9]+$/

export function normalizeAccountIdentifier(identifier: string): string {
  const trimmed = identifier.trim().replace(/\s+/g, " ")
  const compact = trimmed.replaceAll(" ", "").toUpperCase()
  return IBAN_PATTERN.test(compact) ? compact : trimmed
}
