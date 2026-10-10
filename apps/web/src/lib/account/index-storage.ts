import { appDataDir } from "@tauri-apps/api/path"
import { createEntryStore, createFileStore, type Persistence } from "@/lib/local-db/persistence"
import { isTauri } from "@/lib/runtime"
import { type AccountIndex, parseAccountIndex, serializeAccountIndex } from "./account-index"

const INDEX_FILE = "accounts.json"
const INDEX_ENTRY = "accounts"

async function createIndexStore(): Promise<Persistence> {
  return isTauri() ? createFileStore(await appDataDir(), INDEX_FILE) : createEntryStore(INDEX_ENTRY)
}

export async function loadStoredIndex(): Promise<AccountIndex | null> {
  const bytes = await (await createIndexStore()).load()
  return bytes === null ? null : parseAccountIndex(bytes)
}

export async function saveStoredIndex(index: AccountIndex): Promise<void> {
  await (await createIndexStore()).save(serializeAccountIndex(index))
}
