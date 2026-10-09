/** Retient une adresse de serveur exploitable : http(s) uniquement, `null` si le champ est vide ou la saisie invalide. */
export function parseServerUrl(value: string): string | null {
  const trimmed = value.trim()
  if (trimmed === "") return null
  try {
    const url = new URL(trimmed)
    return url.protocol === "http:" || url.protocol === "https:" ? trimmed : null
  } catch {
    return null
  }
}
