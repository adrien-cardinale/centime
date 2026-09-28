export type RuntimeKind = "web" | "desktop"

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
}

export const runtimeKind: RuntimeKind = __CENTIME_DESKTOP__ && isTauri() ? "desktop" : "web"

export const isDesktop = runtimeKind === "desktop"
