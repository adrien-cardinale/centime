import { describe, expect, test } from "bun:test"
import { deriveVault, isSealed } from "./envelope"
import { formatMasterKey, generateMasterKey, MASTER_KEY_BYTES, parseMasterKey } from "./master-key"

describe("clé maître", () => {
  test("fait l'aller-retour via la phrase de récupération", async () => {
    const key = generateMasterKey()
    const phrase = await formatMasterKey(key)
    expect(key.length).toBe(MASTER_KEY_BYTES)
    expect(phrase).toMatch(/^([0-9A-Z]{4}-)+[0-9A-Z]{1,4}$/)
    expect(await parseMasterKey(phrase)).toEqual(key)
  })

  test("tolère minuscules, espaces et confusions O/0 I/L/1", async () => {
    const key = generateMasterKey()
    const phrase = await formatMasterKey(key)
    const sloppy = phrase.toLowerCase().replace(/-/g, " ").replace(/0/g, "o").replace(/1/g, "l")
    expect(await parseMasterKey(sloppy)).toEqual(key)
  })

  test("refuse une faute de frappe ou une clé tronquée", async () => {
    const phrase = await formatMasterKey(generateMasterKey())
    const first = phrase[0] === "A" ? "B" : "A"
    await expect(parseMasterKey(`${first}${phrase.slice(1)}`)).rejects.toThrow("Clé invalide")
    await expect(parseMasterKey(phrase.slice(0, 20))).rejects.toThrow("Clé invalide")
    await expect(parseMasterKey("n'importe quoi!")).rejects.toThrow("Clé invalide")
  })
})

describe("coffre", () => {
  test("dérive des identifiants stables et distincts de la clé", async () => {
    const key = generateMasterKey()
    const first = await deriveVault(key)
    const second = await deriveVault(key)
    expect(first.credentials).toEqual(second.credentials)
    expect(first.credentials.userId).toMatch(/^[0-9a-f]{32}$/)
    expect(first.credentials.secret).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect((await deriveVault(generateMasterKey())).credentials.userId).not.toBe(first.credentials.userId)
  })

  test("chiffre puis déchiffre, avec un IV différent à chaque fois", async () => {
    const vault = await deriveVault(generateMasterKey())
    const plain = new TextEncoder().encode("Café 12.50 CHF")
    const a = await vault.encrypt(plain)
    const b = await vault.encrypt(plain)
    expect(a).not.toEqual(b)
    expect(isSealed(a)).toBe(true)
    expect(await vault.decrypt(a)).toEqual(plain)
    expect(await vault.decryptText(await vault.encryptText("héllo"))).toBe("héllo")
  })

  test("refuse une autre clé et des données altérées", async () => {
    const vault = await deriveVault(generateMasterKey())
    const sealed = await vault.encrypt(new Uint8Array([1, 2, 3]))
    await expect((await deriveVault(generateMasterKey())).decrypt(sealed)).rejects.toThrow("illisibles")
    const tampered = sealed.slice()
    tampered[tampered.length - 1] = (tampered.at(-1) ?? 0) ^ 1
    await expect(vault.decrypt(tampered)).rejects.toThrow("illisibles")
    await expect(vault.decrypt(new Uint8Array([1, 2]))).rejects.toThrow("illisibles")
  })

  test("ne reconnaît pas une base SQLite en clair comme chiffrée", () => {
    const plainDb = new TextEncoder().encode("SQLite format 3\0........................")
    expect(isSealed(plainDb)).toBe(false)
  })
})
