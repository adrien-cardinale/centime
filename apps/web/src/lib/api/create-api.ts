import type { Vault } from "@/lib/crypto/envelope"
import type { Api } from "./types"

export async function createApi(vault: Vault): Promise<Api> {
  return (await import("./local")).createLocalApi(vault)
}
