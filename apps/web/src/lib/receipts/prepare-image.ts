import { MAX_RECEIPT_BYTES } from "@centime/core"

const MAX_SIDE = 1600
const JPEG_QUALITY = 0.82
const JPEG_MIME = "image/jpeg"
const PDF_MIME = "application/pdf"
const PDF_EXTENSION = /\.pdf$/i
const IMAGE_EXTENSION = /\.(jpe?g|png|webp|gif|bmp|heic|heif|avif)$/i

const UNSUPPORTED_FILE = "Format non pris en charge : choisissez une photo ou un PDF"
const FILE_TOO_LARGE = "Fichier trop volumineux (7 Mo maximum)"
const UNREADABLE_IMAGE = "Image illisible : essayez une autre photo"
const ENCODING_FAILED = "Conversion de l'image impossible"

export type PreparedReceiptImage = {
  bytes: Uint8Array
  mime: typeof JPEG_MIME | typeof PDF_MIME
  width: number | null
  height: number | null
  sha256: string
}

type DecodedImage = { source: CanvasImageSource; width: number; height: number; release: () => void }

export function isPreparedReceiptImage(value: unknown): value is PreparedReceiptImage {
  return typeof value === "object" && value !== null && "bytes" in value && "sha256" in value
}

function isPdf(file: File): boolean {
  return file.type === PDF_MIME || PDF_EXTENSION.test(file.name)
}

function isImage(file: File): boolean {
  return file.type.startsWith("image/") || IMAGE_EXTENSION.test(file.name)
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

function loadImageElement(file: File): Promise<DecodedImage> {
  const url = URL.createObjectURL(file)
  const image = new Image()
  image.src = url
  return image
    .decode()
    .then(() => ({
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    }))
    .catch(() => {
      URL.revokeObjectURL(url)
      throw new Error(UNREADABLE_IMAGE)
    })
}

async function decodeImage(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap !== "function") return loadImageElement(file)
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
    return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() }
  } catch {
    return loadImageElement(file)
  }
}

function scaledSize(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error(ENCODING_FAILED))),
      JPEG_MIME,
      JPEG_QUALITY,
    )
  })
}

async function encodeJpeg(image: DecodedImage): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  const size = scaledSize(image.width, image.height)
  const canvas = document.createElement("canvas")
  canvas.width = size.width
  canvas.height = size.height
  const context = canvas.getContext("2d")
  if (!context) throw new Error(ENCODING_FAILED)
  context.fillStyle = "#ffffff"
  context.fillRect(0, 0, size.width, size.height)
  context.drawImage(image.source, 0, 0, size.width, size.height)
  const blob = await canvasToJpeg(canvas)
  return { bytes: new Uint8Array(await blob.arrayBuffer()), ...size }
}

async function preparePdf(file: File): Promise<PreparedReceiptImage> {
  if (file.size > MAX_RECEIPT_BYTES) throw new Error(FILE_TOO_LARGE)
  const bytes = new Uint8Array(await file.arrayBuffer())
  return { bytes, mime: PDF_MIME, width: null, height: null, sha256: await sha256Hex(bytes) }
}

async function preparePhoto(file: File): Promise<PreparedReceiptImage> {
  const decoded = await decodeImage(file)
  try {
    const { bytes, width, height } = await encodeJpeg(decoded)
    if (bytes.byteLength > MAX_RECEIPT_BYTES) throw new Error(FILE_TOO_LARGE)
    return { bytes, mime: JPEG_MIME, width, height, sha256: await sha256Hex(bytes) }
  } finally {
    decoded.release()
  }
}

export async function prepareReceiptImage(file: File): Promise<PreparedReceiptImage> {
  if (isPdf(file)) return preparePdf(file)
  if (isImage(file)) return preparePhoto(file)
  throw new Error(UNSUPPORTED_FILE)
}
