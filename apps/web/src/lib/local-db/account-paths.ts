import { appDataDir, join } from "@tauri-apps/api/path"
import { exists, remove } from "@tauri-apps/plugin-fs"

const ACCOUNTS_DIRECTORY = "accounts"

export async function accountDirectory(id: string): Promise<string> {
  return join(await appDataDir(), ACCOUNTS_DIRECTORY, id)
}

export function accountEntry(prefix: string, id: string): string {
  return `${prefix}:${id}`
}

export async function removeAccountDirectory(id: string): Promise<void> {
  const directory = await accountDirectory(id)
  if (await exists(directory)) await remove(directory, { recursive: true })
}
