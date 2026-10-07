const encoder = new TextEncoder()
const decoder = new TextDecoder()

const FORMAT_VERSION = 1
const IV_BYTES = 12
const HEADER_BYTES = 1 + IV_BYTES
const AUTH_SECRET_BYTES = 32
const USER_ID_BYTES = 16
const HKDF_SALT = encoder.encode("centime/v1")
const UNREADABLE = "Données illisibles : la clé ne correspond pas ou les données sont corrompues"

export type Credentials = {
  /** Identifiant public (32 caractères hex), sert à ranger le journal côté serveur. */
  userId: string
  /** Secret d'authentification dérivé (base64url), prouve la connaissance de la clé sans la révéler. */
  secret: string
}

export type Vault = {
  credentials: Credentials
  encrypt(plain: Uint8Array): Promise<Uint8Array>
  decrypt(sealed: Uint8Array): Promise<Uint8Array>
  encryptText(text: string): Promise<string>
  decryptText(sealed: string): Promise<string>
}

export function toBase64(bytes: Uint8Array): string {
  let binary = ""
  const chunk = 0x8000
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk))
  }
  return btoa(binary)
}

export function fromBase64(text: string): Uint8Array {
  const binary = atob(text)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

async function deriveBits(master: CryptoKey, label: string, bytes: number): Promise<Uint8Array> {
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: HKDF_SALT, info: encoder.encode(label) },
    master,
    bytes * 8,
  )
  return new Uint8Array(bits)
}

export async function deriveVault(masterKey: Uint8Array): Promise<Vault> {
  const master = await crypto.subtle.importKey("raw", masterKey as BufferSource, "HKDF", false, ["deriveBits"])
  const userId = toHex(await deriveBits(master, "user-id", USER_ID_BYTES))
  const secret = toBase64Url(await deriveBits(master, "auth-secret", AUTH_SECRET_BYTES))
  const aesKey = await crypto.subtle.importKey(
    "raw",
    (await deriveBits(master, "encryption", 32)) as BufferSource,
    "AES-GCM",
    false,
    ["encrypt", "decrypt"],
  )
  const additionalData = encoder.encode(`centime/v${FORMAT_VERSION}/${userId}`) as BufferSource

  const encrypt = async (plain: Uint8Array): Promise<Uint8Array> => {
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
    const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData }, aesKey, plain as BufferSource)
    const sealed = new Uint8Array(HEADER_BYTES + cipher.byteLength)
    sealed[0] = FORMAT_VERSION
    sealed.set(iv, 1)
    sealed.set(new Uint8Array(cipher), HEADER_BYTES)
    return sealed
  }

  const decrypt = async (sealed: Uint8Array): Promise<Uint8Array> => {
    if (sealed.length <= HEADER_BYTES || sealed[0] !== FORMAT_VERSION) throw new Error(UNREADABLE)
    const iv = sealed.slice(1, HEADER_BYTES)
    try {
      const plain = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv, additionalData },
        aesKey,
        sealed.slice(HEADER_BYTES) as BufferSource,
      )
      return new Uint8Array(plain)
    } catch {
      throw new Error(UNREADABLE)
    }
  }

  return {
    credentials: { userId, secret },
    encrypt,
    decrypt,
    encryptText: async (text) => toBase64(await encrypt(encoder.encode(text))),
    decryptText: async (sealed) => decoder.decode(await decrypt(fromBase64(sealed))),
  }
}

/** Reconnaît un fichier chiffré par `Vault.encrypt` (la base SQLite en clair commence par « SQLite format 3 »). */
export function isSealed(bytes: Uint8Array): boolean {
  return bytes.length > HEADER_BYTES && bytes[0] === FORMAT_VERSION
}
