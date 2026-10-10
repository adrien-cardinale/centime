import { describe, expect, test } from "bun:test"
import {
  type AccountIndex,
  activeAccount,
  EMPTY_ACCOUNT_INDEX,
  nextDefaultLabel,
  parseAccountIndex,
  serializeAccountIndex,
  withAccount,
  withActive,
  withActiveIfNone,
  withLabel,
  withoutAccount,
  withPendingServerUrl,
} from "./account-index"

const FIRST_ID = "a".repeat(32)
const SECOND_ID = "b".repeat(32)
const CREATED_AT = "2026-01-01T00:00:00.000Z"
const label = (n: number) => `Compte ${n}`

function account(id: string, name: string) {
  return { id, label: name, createdAt: CREATED_AT }
}

function twoAccounts(): AccountIndex {
  const index = withAccount(withAccount(EMPTY_ACCOUNT_INDEX, account(FIRST_ID, "Perso")), account(SECOND_ID, "Pro"))
  return withActive(index, FIRST_ID)
}

describe("index des comptes", () => {
  test("fait l'aller-retour en JSON", () => {
    const index = withPendingServerUrl(twoAccounts(), SECOND_ID, "https://centime.example.ch")
    expect(parseAccountIndex(serializeAccountIndex(index))).toEqual(index)
  })

  test("refuse un index mal formé", () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ version: 2, activeId: null, accounts: [] }))
    expect(() => parseAccountIndex(bytes)).toThrow()
  })

  test("n'ajoute pas deux fois le même compte", () => {
    const index = withAccount(twoAccounts(), account(FIRST_ID, "Doublon"))
    expect(index.accounts.map((entry) => entry.label)).toEqual(["Perso", "Pro"])
  })

  test("ignore l'activation d'un compte inconnu", () => {
    expect(withActive(twoAccounts(), "c".repeat(32)).activeId).toBe(FIRST_ID)
  })

  test("garde le compte actif lors d'une migration", () => {
    const index = withActiveIfNone(twoAccounts(), SECOND_ID)
    expect(activeAccount(index)?.id).toBe(FIRST_ID)
    expect(withActiveIfNone(withAccount(EMPTY_ACCOUNT_INDEX, account(SECOND_ID, "Pro")), SECOND_ID).activeId).toBe(SECOND_ID)
  })

  test("renomme un compte", () => {
    expect(withLabel(twoAccounts(), SECOND_ID, "Famille").accounts[1]?.label).toBe("Famille")
  })

  test("passe au compte suivant quand le compte actif est retiré", () => {
    const index = withoutAccount(twoAccounts(), FIRST_ID)
    expect(index.activeId).toBe(SECOND_ID)
    expect(withoutAccount(index, SECOND_ID)).toEqual(EMPTY_ACCOUNT_INDEX)
  })

  test("propose le premier nom par défaut libre", () => {
    expect(nextDefaultLabel(EMPTY_ACCOUNT_INDEX, label)).toBe("Compte 1")
    const index = withAccount(withAccount(EMPTY_ACCOUNT_INDEX, account(FIRST_ID, "Compte 1")), account(SECOND_ID, "Compte 3"))
    expect(nextDefaultLabel(index, label)).toBe("Compte 2")
  })
})
