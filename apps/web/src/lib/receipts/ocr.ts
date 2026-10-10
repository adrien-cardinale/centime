import { parseReceiptText, type ReceiptOcrResult } from "@centime/core"
import coreUrl from "tesseract.js-core/tesseract-core-lstm.wasm.js?url"
import coreSimdUrl from "tesseract.js-core/tesseract-core-simd-lstm.wasm.js?url"
import workerUrl from "tesseract.js/dist/worker.min.js?url"
import { ocrProgressRatio } from "./ocr-progress"

type TesseractWorker = import("tesseract.js").Worker

export type RecognizedReceipt = ReceiptOcrResult & { rawText: string }

export type RecognizeReceiptOptions = {
  onProgress?: (ratio: number) => void
  signal?: AbortSignal
}

const LANGUAGES = "fra+eng"
const CACHE_PATH = "centime-ocr"
const IDLE_TIMEOUT_MS = 60_000
const TARGET_SIDE = 2000
const PREPROCESSED_MIME = "image/jpeg"
const PREPROCESSED_QUALITY = 0.92
const SUPPORTED_MIME = /^image\//

let workerPromise: Promise<TesseractWorker> | null = null
let idleTimer: ReturnType<typeof setTimeout> | null = null
let progressListener: ((ratio: number) => void) | null = null
let activeJobs = 0

export function isOcrSupported(mime: string): boolean {
  return SUPPORTED_MIME.test(mime)
}

async function createOcrWorker(): Promise<TesseractWorker> {
  const [tesseract, { simd }] = await Promise.all([import("tesseract.js"), import("wasm-feature-detect")])
  const corePath = (await simd()) ? coreSimdUrl : coreUrl
  return tesseract.createWorker(LANGUAGES, tesseract.OEM.LSTM_ONLY, {
    workerPath: workerUrl,
    corePath,
    workerBlobURL: false,
    cacheMethod: "write",
    cachePath: CACHE_PATH,
    logger: ({ status, progress }) => {
      const ratio = ocrProgressRatio(status, progress)
      if (ratio !== null) progressListener?.(ratio)
    },
  })
}

function sharedWorker(): Promise<TesseractWorker> {
  if (!workerPromise) {
    workerPromise = createOcrWorker()
    workerPromise.catch(() => {
      workerPromise = null
    })
  }
  return workerPromise
}

function clearIdleTimer() {
  if (idleTimer !== null) clearTimeout(idleTimer)
  idleTimer = null
}

export async function terminateOcrWorker(): Promise<void> {
  clearIdleTimer()
  const pending = workerPromise
  workerPromise = null
  if (!pending) return
  const worker = await pending.catch(() => null)
  await worker?.terminate()
}

function scheduleIdleTermination() {
  clearIdleTimer()
  idleTimer = setTimeout(() => void terminateOcrWorker(), IDLE_TIMEOUT_MS)
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, PREPROCESSED_MIME, PREPROCESSED_QUALITY))
}

async function drawForOcr(bitmap: ImageBitmap): Promise<Blob | null> {
  const scale = Math.max(1, TARGET_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const context = canvas.getContext("2d")
  if (!context) return null
  context.filter = "grayscale(1)"
  context.imageSmoothingQuality = "high"
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvasToBlob(canvas)
}

async function preprocess(bytes: Uint8Array, mime: string): Promise<Blob> {
  const original = new Blob([bytes as BlobPart], { type: mime })
  if (typeof createImageBitmap !== "function") return original
  const bitmap = await createImageBitmap(original).catch(() => null)
  if (!bitmap) return original
  try {
    return (await drawForOcr(bitmap)) ?? original
  } finally {
    bitmap.close()
  }
}

function abortError(): DOMException {
  return new DOMException("Lecture du ticket annulée", "AbortError")
}

function rejectOnAbort(signal: AbortSignal | undefined): Promise<never> {
  return new Promise((_, reject) => {
    if (!signal) return
    if (signal.aborted) reject(abortError())
    signal.addEventListener("abort", () => reject(abortError()), { once: true })
  })
}

async function recognizeText(image: Blob, signal: AbortSignal | undefined): Promise<string> {
  const onAbort = () => void terminateOcrWorker()
  signal?.addEventListener("abort", onAbort, { once: true })
  try {
    const recognition = sharedWorker().then((worker) => worker.recognize(image))
    const { data } = await Promise.race([recognition, rejectOnAbort(signal)])
    return data.text
  } finally {
    signal?.removeEventListener("abort", onAbort)
  }
}

export async function recognizeReceipt(
  bytes: Uint8Array,
  mime: string,
  options: RecognizeReceiptOptions = {},
): Promise<RecognizedReceipt> {
  if (!isOcrSupported(mime)) throw new Error("Seules les photos peuvent être lues")
  const { onProgress, signal } = options
  if (signal?.aborted) throw abortError()
  clearIdleTimer()
  activeJobs += 1
  const listener = onProgress ?? null
  progressListener = listener
  try {
    const image = await preprocess(bytes, mime)
    if (signal?.aborted) throw abortError()
    const rawText = await recognizeText(image, signal)
    return { ...parseReceiptText(rawText), rawText }
  } finally {
    activeJobs -= 1
    if (progressListener === listener) progressListener = null
    if (activeJobs === 0 && workerPromise) scheduleIdleTermination()
  }
}
