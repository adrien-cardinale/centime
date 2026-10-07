export const MASTER_KEY_BYTES = 32

const BASE32_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
const CHECKSUM_BYTES = 2
const GROUP_SIZE = 4
const INVALID_PHRASE = "Clé invalide : vérifie qu'elle est complète et sans faute de frappe"

export function generateMasterKey(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(MASTER_KEY_BYTES))
}

async function checksumOf(bytes: Uint8Array): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource)
  return new Uint8Array(digest).slice(0, CHECKSUM_BYTES)
}

function encodeBase32(bytes: Uint8Array): string {
  let bits = 0
  let value = 0
  let output = ""
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  return output
}

function decodeBase32(text: string): Uint8Array | null {
  let bits = 0
  let value = 0
  const bytes: number[] = []
  for (const char of text) {
    const index = BASE32_ALPHABET.indexOf(char)
    if (index < 0) return null
    value = (value << 5) | index
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return new Uint8Array(bytes)
}

function normalizePhrase(phrase: string): string {
  return phrase.toUpperCase().replace(/[\s-]+/g, "").replace(/O/g, "0").replace(/[IL]/g, "1")
}

export async function formatMasterKey(key: Uint8Array): Promise<string> {
  const payload = new Uint8Array([...key, ...(await checksumOf(key))])
  const text = encodeBase32(payload)
  const groups: string[] = []
  for (let index = 0; index < text.length; index += GROUP_SIZE) groups.push(text.slice(index, index + GROUP_SIZE))
  return groups.join("-")
}

export async function parseMasterKey(phrase: string): Promise<Uint8Array> {
  const bytes = decodeBase32(normalizePhrase(phrase))
  if (!bytes || bytes.length < MASTER_KEY_BYTES + CHECKSUM_BYTES) throw new Error(INVALID_PHRASE)
  const key = bytes.slice(0, MASTER_KEY_BYTES)
  const checksum = bytes.slice(MASTER_KEY_BYTES, MASTER_KEY_BYTES + CHECKSUM_BYTES)
  const expected = await checksumOf(key)
  if (checksum.some((byte, index) => byte !== expected[index])) throw new Error(INVALID_PHRASE)
  return key
}
