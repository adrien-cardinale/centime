import * as React from "react"

const OVERLAY_ID_KEY = "overlayId"
const OVERLAY_DEPTH_KEY = "overlayDepth"
const ROUTER_KEY = "__TSR_key"

type HistoryState = Record<string, unknown> | null

type OpenOverlay = {
  id: string
  depth: number
  href: string
  routerKey: unknown
  close: () => void
}

const openOverlays: OpenOverlay[] = []
let nextOverlayNumber = 0
let pendingSilentPops = 0
let listening = false

function currentState(): HistoryState {
  const state: unknown = window.history.state
  return typeof state === "object" ? (state as HistoryState) : null
}

function overlayIdOf(state: HistoryState): unknown {
  return state?.[OVERLAY_ID_KEY]
}

function overlayDepthOf(state: HistoryState): number {
  const depth = state?.[OVERLAY_DEPTH_KEY]
  return typeof depth === "number" ? depth : 0
}

function isOpenOverlayId(id: unknown): boolean {
  return openOverlays.some((overlay) => overlay.id === id)
}

function topEntryIsStaleOverlay(): boolean {
  const id = overlayIdOf(currentState())
  return id !== undefined && !isOpenOverlayId(id)
}

// TanStack Router patche window.history.pushState pour recharger la route : on appelle les méthodes natives du prototype pour qu'il ignore nos entrées.
function writeOverlayEntry(overlay: OpenOverlay): void {
  const state = { ...currentState(), [OVERLAY_ID_KEY]: overlay.id, [OVERLAY_DEPTH_KEY]: overlay.depth }
  if (topEntryIsStaleOverlay()) History.prototype.replaceState.call(window.history, state, "")
  else History.prototype.pushState.call(window.history, state, "")
}

function isSameRouterEntry(overlay: OpenOverlay, state: HistoryState): boolean {
  return window.location.href === overlay.href && state?.[ROUTER_KEY] === overlay.routerKey
}

function closeOverlaysAbove(depth: number): OpenOverlay[] {
  const closed = openOverlays.filter((overlay) => overlay.depth > depth).reverse()
  for (const overlay of closed) openOverlays.splice(openOverlays.indexOf(overlay), 1)
  for (const overlay of closed) overlay.close()
  return closed
}

function handlePopState(event: PopStateEvent): void {
  if (pendingSilentPops > 0) {
    pendingSilentPops -= 1
    event.stopImmediatePropagation()
    return
  }
  const top = openOverlays.at(-1)
  if (top === undefined) return
  const state = currentState()
  const leftOnlyOverlayEntries = isSameRouterEntry(top, state)
  const closed = closeOverlaysAbove(overlayDepthOf(state))
  // Écouteur en phase de capture : il passe avant celui de TanStack Router, qui rechargerait la route pour une simple fermeture d'overlay.
  if (closed.length > 0 && leftOnlyOverlayEntries) event.stopImmediatePropagation()
}

function listenToPopState(): void {
  if (listening) return
  listening = true
  window.addEventListener("popstate", handlePopState, { capture: true })
}

function openOverlay(close: () => void): string {
  listenToPopState()
  nextOverlayNumber += 1
  const overlay: OpenOverlay = {
    id: `overlay-${nextOverlayNumber}`,
    depth: openOverlays.length + 1,
    href: window.location.href,
    routerKey: currentState()?.[ROUTER_KEY],
    close,
  }
  writeOverlayEntry(overlay)
  openOverlays.push(overlay)
  return overlay.id
}

function removeOverlayEntryIfOnTop(id: string): void {
  if (overlayIdOf(currentState()) !== id) return
  pendingSilentPops += 1
  window.history.back()
}

function releaseOverlay(id: string): void {
  const index = openOverlays.findIndex((overlay) => overlay.id === id)
  if (index === -1) return
  openOverlays.splice(index, 1)
  // Différé d'une tâche : une navigation déclenchée dans le même clic pousse son URL en microtâche, et un back() immédiat l'annulerait.
  window.setTimeout(() => removeOverlayEntryIfOnTop(id), 0)
}

export function useOverlayHistory(open: boolean, onClose: () => void): void {
  const onCloseRef = React.useRef(onClose)

  React.useEffect(() => {
    onCloseRef.current = onClose
  })

  React.useEffect(() => {
    if (!open || typeof window === "undefined") return
    const id = openOverlay(() => onCloseRef.current())
    return () => releaseOverlay(id)
  }, [open])
}

type OverlayOpenProps = {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

export function useHistoryAwareOpen({ open, defaultOpen = false, onOpenChange }: OverlayOpenProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen)
  const isControlled = open !== undefined
  const currentOpen = isControlled ? open : uncontrolledOpen

  const changeOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next)
      onOpenChange?.(next)
    },
    [isControlled, onOpenChange],
  )

  useOverlayHistory(currentOpen, () => changeOpen(false))

  return { open: currentOpen, onOpenChange: changeOpen }
}
