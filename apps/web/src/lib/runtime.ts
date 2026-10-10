import { platform } from "@tauri-apps/plugin-os"

export type RuntimeKind = "web" | "desktop" | "android"

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
}

/** Application packagée tournant sur Android : le navigateur mobile ne compte pas, les plugins Tauri y manquent. */
export function isAndroid(): boolean {
  return isTauri() && platform() === "android"
}

function detectRuntimeKind(): RuntimeKind {
  if (!isTauri()) return "web"
  return isAndroid() ? "android" : "desktop"
}

export const runtimeKind: RuntimeKind = detectRuntimeKind()
