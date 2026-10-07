import type { Vault } from "./envelope"

let current: Vault | null = null

export function setVault(vault: Vault): void {
  current = vault
}

export function getVault(): Vault {
  if (!current) throw new Error("Clé de chiffrement non chargée")
  return current
}
