import { platform } from "@tauri-apps/plugin-os"

export type RuntimeKind = "web" | "desktop"

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
}

export const runtimeKind: RuntimeKind = isTauri() ? "desktop" : "web"

export const isDesktop = runtimeKind === "desktop"

/** Application packagée tournant sur Android : le navigateur mobile ne compte pas, les plugins Tauri y manquent. */
export function isAndroid(): boolean {
  return isTauri() && platform() === "android"
}
