import { useEffect, useSyncExternalStore } from "react"

const APP_NAME = "centime"

let currentTitle = ""
const listeners = new Set<() => void>()

function setCurrentTitle(title: string): void {
  currentTitle = title
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Titre de la page courante, affiché dans l'en-tête de l'application. */
export function useCurrentPageTitle(): string {
  return useSyncExternalStore(subscribe, () => currentTitle)
}

export function usePageTitle(title: string): void {
  useEffect(() => {
    document.title = `${title} · ${APP_NAME}`
    setCurrentTitle(title)
  }, [title])
}
