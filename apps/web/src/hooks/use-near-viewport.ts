import { useCallback, useEffect, useState } from "react"

const DEFAULT_ROOT_MARGIN = "300px"

export function useNearViewport<Element extends HTMLElement>(
  rootMargin = DEFAULT_ROOT_MARGIN,
): [(element: Element | null) => void, boolean] {
  const [element, setElement] = useState<Element | null>(null)
  const [near, setNear] = useState(() => typeof IntersectionObserver === "undefined")

  useEffect(() => {
    if (near || element === null) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setNear(true)
      },
      { rootMargin },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [element, near, rootMargin])

  const ref = useCallback((next: Element | null) => setElement(next), [])
  return [ref, near]
}
