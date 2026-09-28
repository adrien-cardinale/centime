import type { Api } from "./types"

let currentApi: Api | null = null

export function setApi(api: Api): void {
  currentApi = api
}

export function getApi(): Api {
  if (!currentApi) throw new Error("Client API non initialisé")
  return currentApi
}
