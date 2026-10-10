import { removeAccountDirectory } from "@/lib/local-db/account-paths"
import { createKeyStore } from "@/lib/local-db/key-store"
import { createDatabaseStore } from "@/lib/local-db/persistence"
import { createSerialQueue } from "@/lib/local-db/serial-queue"
import { isTauri } from "@/lib/runtime"
import {
  type AccountIndex,
  activeAccount,
  type DeviceAccount,
  EMPTY_ACCOUNT_INDEX,
  findAccount,
  withAccount,
  withActive,
  withLabel,
  withoutAccount,
  withPendingServerUrl,
} from "./account-index"
import { loadStoredIndex, saveStoredIndex } from "./index-storage"
import { migrateLegacyAccount } from "./legacy-migration"

const queue = createSerialQueue()
let migration: Promise<void> | null = null

function ensureMigrated(): Promise<void> {
  migration ??= migrateLegacyAccount().catch((error: unknown) => {
    migration = null
    throw error
  })
  return migration
}

export async function readAccountIndex(): Promise<AccountIndex> {
  await ensureMigrated()
  return (await loadStoredIndex()) ?? EMPTY_ACCOUNT_INDEX
}

export async function writeAccountIndex(index: AccountIndex): Promise<void> {
  await ensureMigrated()
  await saveStoredIndex(index)
}

function updateAccountIndex(change: (index: AccountIndex) => AccountIndex): Promise<AccountIndex> {
  return queue(async () => {
    const next = change(await readAccountIndex())
    await writeAccountIndex(next)
    return next
  })
}

export async function listAccounts(): Promise<DeviceAccount[]> {
  return (await readAccountIndex()).accounts
}

export async function getActiveAccount(): Promise<DeviceAccount | null> {
  return activeAccount(await readAccountIndex())
}

export async function setActiveAccount(id: string): Promise<void> {
  await updateAccountIndex((index) => withActive(index, id))
}

type NewAccount = { id: string; label: string; pendingServerUrl: string | null }

export async function addAccount({ id, label, pendingServerUrl }: NewAccount): Promise<void> {
  const account = { id, label, pendingServerUrl, createdAt: new Date().toISOString() }
  await updateAccountIndex((index) => withAccount(index, account))
}

export async function renameAccount(id: string, label: string): Promise<void> {
  await updateAccountIndex((index) => withLabel(index, id, label))
}

export async function storePendingServerUrl(id: string, serverUrl: string): Promise<void> {
  await updateAccountIndex((index) => withPendingServerUrl(index, id, serverUrl))
}

async function removeAccountFiles(id: string): Promise<void> {
  if (isTauri()) return removeAccountDirectory(id)
  await (await createKeyStore(id)).clear()
  await (await createDatabaseStore(id)).remove()
}

export async function removeAccount(id: string): Promise<void> {
  await removeAccountFiles(id)
  await updateAccountIndex((index) => withoutAccount(index, id))
}

export async function takePendingServerUrl(id: string): Promise<string | null> {
  const serverUrl = findAccount(await readAccountIndex(), id)?.pendingServerUrl ?? null
  if (serverUrl !== null) await updateAccountIndex((index) => withPendingServerUrl(index, id, null))
  return serverUrl
}
