import { describe, expect, test } from "bun:test"
import { buildDeviceLink, parseDeviceLink } from "./device-link"
import { generateMasterKey } from "./master-key"

describe("lien d'appairage", () => {
  test("transporte la clé et l'adresse du serveur", async () => {
    const key = generateMasterKey()
    const link = await buildDeviceLink(key, "https://centime.example.ch:8443/relay")
    expect(link.startsWith("centime://link?")).toBe(true)
    expect(await parseDeviceLink(link)).toEqual({ key, serverUrl: "https://centime.example.ch:8443/relay" })
  })

  test("accepte un appareil sans serveur configuré", async () => {
    const key = generateMasterKey()
    expect(await parseDeviceLink(await buildDeviceLink(key, null))).toEqual({ key, serverUrl: null })
  })

  test("ignore une adresse de serveur inexploitable", async () => {
    const key = generateMasterKey()
    const link = (await buildDeviceLink(key, null)) + `&s=${encodeURIComponent("javascript:alert(1)")}`
    expect((await parseDeviceLink(link)).serverUrl).toBe(null)
  })

  test("refuse un QR code étranger, une version inconnue ou une clé abîmée", async () => {
    const link = await buildDeviceLink(generateMasterKey(), null)
    await expect(parseDeviceLink("https://example.ch")).rejects.toThrow("QR code invalide")
    await expect(parseDeviceLink("pas une url")).rejects.toThrow("QR code invalide")
    await expect(parseDeviceLink("centime://autre?v=1&k=ABCD")).rejects.toThrow("QR code invalide")
    await expect(parseDeviceLink(link.replace("v=1", "v=2"))).rejects.toThrow("QR code invalide")
    await expect(parseDeviceLink(link.replace(/k=./, "k=")).catch((error: Error) => error.message)).resolves.toMatch(
      /Clé invalide/,
    )
  })
})
