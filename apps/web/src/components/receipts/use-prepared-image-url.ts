import { useEffect, useState } from "react"
import type { PreparedReceiptImage } from "@/lib/receipts/prepare-image"

export function usePreparedImageUrl(image: PreparedReceiptImage): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    const next = URL.createObjectURL(new Blob([image.bytes as BlobPart], { type: image.mime }))
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [image])
  return url
}
