import { join } from "@tauri-apps/api/path"
import { exists, readDir, remove } from "@tauri-apps/plugin-fs"
import { getVault } from "@/lib/crypto/current-vault"
import { accountDirectory, accountEntry } from "@/lib/local-db/account-paths"
import { idbDelete, idbKeysWithPrefix } from "@/lib/local-db/idb"
import { createEntryStore, createFileStore, type Persistence, withEncryption } from "@/lib/local-db/persistence"
import { isTauri } from "@/lib/runtime"

const RECEIPTS_DIRECTORY = "receipts"
const RECEIPT_ENTRY = "receipt"
const IMAGE_EXTENSION = ".bin"
const SAFE_ID = /^[A-Za-z0-9-]+$/
const INVALID_ID = "Identifiant de ticket invalide"
const MISSING_IMAGE = "Image du ticket introuvable"

function currentAccountId(): string {
  return getVault().credentials.userId
}

function checkedId(id: string): string {
  if (!SAFE_ID.test(id)) throw new Error(INVALID_ID)
  return id
}

function entryPrefix(accountId: string): string {
  return `${accountEntry(RECEIPT_ENTRY, accountId)}:`
}

async function receiptDirectory(accountId: string): Promise<string> {
  return join(await accountDirectory(accountId), RECEIPTS_DIRECTORY)
}

async function rawImageStore(id: string): Promise<Persistence> {
  const accountId = currentAccountId()
  if (!isTauri()) return createEntryStore(`${entryPrefix(accountId)}${checkedId(id)}`)
  return createFileStore(await receiptDirectory(accountId), `${checkedId(id)}${IMAGE_EXTENSION}`)
}

async function encryptedImageStore(id: string): Promise<Persistence> {
  return withEncryption(await rawImageStore(id), getVault())
}

export async function saveReceiptImage(id: string, bytes: Uint8Array): Promise<void> {
  await (await encryptedImageStore(id)).save(bytes)
}

export async function loadReceiptImage(id: string): Promise<Uint8Array | null> {
  return (await encryptedImageStore(id)).load()
}

export async function readSealedReceiptImage(id: string): Promise<Uint8Array | null> {
  return (await rawImageStore(id)).load()
}

export async function writeSealedReceiptImage(id: string, sealed: Uint8Array): Promise<void> {
  await (await rawImageStore(id)).save(sealed)
}

export async function deleteReceiptImage(id: string): Promise<void> {
  await (await rawImageStore(id)).remove()
}

export async function moveReceiptImage(fromId: string, toId: string): Promise<void> {
  const source = await rawImageStore(fromId)
  const sealed = await source.load()
  if (sealed === null) throw new Error(MISSING_IMAGE)
  await (await rawImageStore(toId)).save(sealed)
  await source.remove()
}

async function listFileIds(accountId: string): Promise<string[]> {
  const directory = await receiptDirectory(accountId)
  if (!(await exists(directory))) return []
  const entries = await readDir(directory)
  return entries
    .filter((entry) => entry.isFile && entry.name.endsWith(IMAGE_EXTENSION))
    .map((entry) => entry.name.slice(0, -IMAGE_EXTENSION.length))
}

async function listEntryIds(accountId: string): Promise<string[]> {
  const prefix = entryPrefix(accountId)
  return (await idbKeysWithPrefix(prefix)).map((key) => key.slice(prefix.length))
}

export async function listReceiptImageIds(): Promise<string[]> {
  const accountId = currentAccountId()
  return isTauri() ? listFileIds(accountId) : listEntryIds(accountId)
}

export async function removeAccountReceiptImages(accountId: string): Promise<void> {
  if (isTauri()) {
    const directory = await receiptDirectory(accountId)
    if (await exists(directory)) await remove(directory, { recursive: true })
    return
  }
  const prefix = entryPrefix(accountId)
  for (const key of await idbKeysWithPrefix(prefix)) await idbDelete(key)
}
