import { MAX_RECEIPT_BYTES } from "@centime/core"
import { type CropRect, clampCrop, findReceiptBounds, isFullCrop } from "./receipt-crop"

const MAX_SIDE = 1600
const JPEG_QUALITY = 0.82
const CROPPED_SOURCE_QUALITY = 0.92
const MIN_CROP_RATIO = 0.02
const ANALYSIS_SIDE = 200
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
  source: Blob | null
}

type DecodedImage = { source: CanvasImageSource; width: number; height: number; release: () => void }

type Region = { x: number; y: number; width: number; height: number }

type Size = { width: number; height: number }

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

function loadImageElement(file: Blob): Promise<DecodedImage> {
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

async function decodeImage(file: Blob): Promise<DecodedImage> {
  if (typeof createImageBitmap !== "function") return loadImageElement(file)
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
    return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() }
  } catch {
    return loadImageElement(file)
  }
}

function scaledSize(width: number, height: number, maxSide = MAX_SIDE): Size {
  const scale = Math.min(1, maxSide / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

function wholeRegion(image: Size): Region {
  return { x: 0, y: 0, width: image.width, height: image.height }
}

function drawRegion(source: CanvasImageSource, region: Region, size: Size): HTMLCanvasElement {
  const canvas = document.createElement("canvas")
  canvas.width = size.width
  canvas.height = size.height
  const context = canvas.getContext("2d")
  if (!context) throw new Error(ENCODING_FAILED)
  context.fillStyle = "#ffffff"
  context.fillRect(0, 0, size.width, size.height)
  context.drawImage(source, region.x, region.y, region.width, region.height, 0, 0, size.width, size.height)
  return canvas
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error(ENCODING_FAILED))), JPEG_MIME, quality)
  })
}

async function encodeJpeg(image: DecodedImage): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  const size = scaledSize(image.width, image.height)
  const canvas = drawRegion(image.source, wholeRegion(image), size)
  const blob = await canvasToJpeg(canvas, JPEG_QUALITY)
  return { bytes: new Uint8Array(await blob.arrayBuffer()), ...size }
}

async function preparePdf(file: File): Promise<PreparedReceiptImage> {
  if (file.size > MAX_RECEIPT_BYTES) throw new Error(FILE_TOO_LARGE)
  const bytes = new Uint8Array(await file.arrayBuffer())
  return { bytes, mime: PDF_MIME, width: null, height: null, sha256: await sha256Hex(bytes), source: null }
}

async function preparePhoto(file: File): Promise<PreparedReceiptImage> {
  const decoded = await decodeImage(file)
  try {
    const { bytes, width, height } = await encodeJpeg(decoded)
    if (bytes.byteLength > MAX_RECEIPT_BYTES) throw new Error(FILE_TOO_LARGE)
    return { bytes, mime: JPEG_MIME, width, height, sha256: await sha256Hex(bytes), source: file }
  } finally {
    decoded.release()
  }
}

export async function prepareReceiptImage(file: File): Promise<PreparedReceiptImage> {
  if (isPdf(file)) return preparePdf(file)
  if (isImage(file)) return preparePhoto(file)
  throw new Error(UNSUPPORTED_FILE)
}

function preparedBlob(image: PreparedReceiptImage): Blob {
  return new Blob([image.bytes as BlobPart], { type: image.mime })
}

async function decodeFullResolution(image: PreparedReceiptImage): Promise<DecodedImage> {
  if (image.source) {
    try {
      return await decodeImage(image.source)
    } catch {
      return decodeImage(preparedBlob(image))
    }
  }
  return decodeImage(preparedBlob(image))
}

function isDegenerate(rect: CropRect): boolean {
  return rect.width < MIN_CROP_RATIO || rect.height < MIN_CROP_RATIO
}

function pixelRegion(rect: CropRect, image: Size): Region {
  const x = Math.round(rect.x * image.width)
  const y = Math.round(rect.y * image.height)
  return {
    x,
    y,
    width: Math.max(1, Math.min(image.width - x, Math.round(rect.width * image.width))),
    height: Math.max(1, Math.min(image.height - y, Math.round(rect.height * image.height))),
  }
}

async function cropDecoded(decoded: DecodedImage, rect: CropRect): Promise<PreparedReceiptImage> {
  const region = pixelRegion(rect, decoded)
  const cropped = drawRegion(decoded.source, region, region)
  const source = await canvasToJpeg(cropped, CROPPED_SOURCE_QUALITY)
  const { bytes, width, height } = await encodeJpeg({ source: cropped, ...wholeRegion(region), release: () => {} })
  if (bytes.byteLength > MAX_RECEIPT_BYTES) throw new Error(FILE_TOO_LARGE)
  return { bytes, mime: JPEG_MIME, width, height, sha256: await sha256Hex(bytes), source }
}

export async function cropReceiptImage(image: PreparedReceiptImage, rect: CropRect): Promise<PreparedReceiptImage> {
  const bounded = clampCrop(rect)
  if (image.mime === PDF_MIME || isDegenerate(bounded) || isFullCrop(bounded)) return image
  const decoded = await decodeFullResolution(image)
  try {
    return await cropDecoded(decoded, bounded)
  } finally {
    decoded.release()
  }
}

function luminanceOf(pixels: Uint8ClampedArray): Uint8Array {
  const luminance = new Uint8Array(pixels.length / 4)
  for (let index = 0; index < luminance.length; index += 1) {
    const offset = index * 4
    luminance[index] = Math.round(
      0.299 * (pixels[offset] ?? 0) + 0.587 * (pixels[offset + 1] ?? 0) + 0.114 * (pixels[offset + 2] ?? 0),
    )
  }
  return luminance
}

function analyse(decoded: DecodedImage): CropRect | null {
  const size = scaledSize(decoded.width, decoded.height, ANALYSIS_SIDE)
  const canvas = drawRegion(decoded.source, wholeRegion(decoded), size)
  const context = canvas.getContext("2d")
  if (!context) return null
  const { data } = context.getImageData(0, 0, size.width, size.height)
  return findReceiptBounds(luminanceOf(data), size.width, size.height)
}

export async function suggestReceiptCrop(image: PreparedReceiptImage): Promise<CropRect | null> {
  if (image.mime === PDF_MIME) return null
  try {
    const decoded = await decodeImage(preparedBlob(image))
    try {
      return analyse(decoded)
    } finally {
      decoded.release()
    }
  } catch {
    return null
  }
}
