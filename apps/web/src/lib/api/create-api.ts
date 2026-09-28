import { isTauri } from "@/lib/runtime"
import type { Api } from "./types"

export async function createApi(): Promise<Api> {
  if (__CENTIME_DESKTOP__ && isTauri()) return (await import("./local")).createLocalApi()
  return (await import("./http")).createHttpApi()
}
