import { parseServerUrl } from "@/lib/sync/server-url"
import { formatMasterKey, parseMasterKey } from "./master-key"

/** Lien d'appairage encodé dans le QR code : la clé maître et, si elle est connue, l'adresse du serveur. */
const SCHEME = "centime:"
const HOST = "link"
const VERSION = "1"
const INVALID_LINK = "QR code invalide : il ne vient pas de centime"

export type DeviceLink = { key: Uint8Array; serverUrl: string | null }

export async function buildDeviceLink(key: Uint8Array, serverUrl: string | null): Promise<string> {
  const phrase = await formatMasterKey(key)
  const params = new URLSearchParams({ v: VERSION, k: phrase.replaceAll("-", "") })
  if (serverUrl !== null) params.set("s", serverUrl)
  return `${SCHEME}//${HOST}?${params.toString()}`
}

export async function parseDeviceLink(text: string): Promise<DeviceLink> {
  let url: URL
  try {
    url = new URL(text.trim())
  } catch {
    throw new Error(INVALID_LINK)
  }
  if (url.protocol !== SCHEME || url.host !== HOST || url.searchParams.get("v") !== VERSION) {
    throw new Error(INVALID_LINK)
  }
  const phrase = url.searchParams.get("k")
  if (phrase === null) throw new Error(INVALID_LINK)
  const server = url.searchParams.get("s")
  return { key: await parseMasterKey(phrase), serverUrl: server === null ? null : parseServerUrl(server) }
}
