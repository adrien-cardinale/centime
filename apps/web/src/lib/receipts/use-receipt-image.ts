import { useEffect, useState } from "react"
import { fetchMissingReceiptImage } from "@/lib/sync/sync-store"
import { loadReceiptImage } from "./receipt-store"

type CachedImage = { url: Promise<string | null>; users: number }
type LoadedImage = { id: string; url: string | null }

const cachedImages = new Map<string, CachedImage>()

async function loadOrFetchImage(id: string): Promise<Uint8Array | null> {
  const bytes = await loadReceiptImage(id)
  if (bytes !== null) return bytes
  return (await fetchMissingReceiptImage(id)) ? loadReceiptImage(id) : null
}

async function createObjectUrl(id: string, mime: string): Promise<string | null> {
  try {
    const bytes = await loadOrFetchImage(id)
    return bytes === null ? null : URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }))
  } catch (error) {
    console.error("Lecture de l'image du ticket impossible", error)
    return null
  }
}

function acquireImage(id: string, mime: string): Promise<string | null> {
  const cached = cachedImages.get(id) ?? { url: createObjectUrl(id, mime), users: 0 }
  cached.users += 1
  cachedImages.set(id, cached)
  return cached.url
}

function releaseImage(id: string): void {
  const cached = cachedImages.get(id)
  if (!cached) return
  cached.users -= 1
  if (cached.users > 0) return
  cachedImages.delete(id)
  void cached.url.then((url) => url !== null && URL.revokeObjectURL(url))
}

export function useReceiptImage(id: string | null, mime: string): string | null {
  const [loaded, setLoaded] = useState<LoadedImage | null>(null)

  useEffect(() => {
    if (id === null) return
    let active = true
    void acquireImage(id, mime).then((url) => {
      if (active) setLoaded({ id, url })
    })
    return () => {
      active = false
      releaseImage(id)
    }
  }, [id, mime])

  return loaded !== null && loaded.id === id ? loaded.url : null
}
