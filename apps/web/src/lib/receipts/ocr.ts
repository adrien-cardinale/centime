import { parseReceiptText, type ReceiptOcrResult } from "@centime/core"
import coreUrl from "tesseract.js-core/tesseract-core-lstm.wasm.js?url"
import coreSimdUrl from "tesseract.js-core/tesseract-core-simd-lstm.wasm.js?url"
import workerUrl from "tesseract.js/dist/worker.min.js?url"
import { ocrProgressRatio } from "./ocr-progress"
import type { PreparedReceiptImage } from "./prepare-image"

type TesseractWorker = import("tesseract.js").Worker

export type OcrImage = Pick<PreparedReceiptImage, "bytes" | "mime" | "source">

export type RecognizedReceipt = ReceiptOcrResult & { rawText: string }

export type RecognizeReceiptOptions = {
  onProgress?: (ratio: number) => void
  signal?: AbortSignal
}

const LANGUAGES = "fra+eng"
const CACHE_PATH = "centime-ocr"
const IDLE_TIMEOUT_MS = 60_000
const MIN_OCR_SIDE = 2000
const MAX_OCR_SIDE = 3000
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
  const [{ createWorker, OEM, PSM }, { simd }] = await Promise.all([
    import("tesseract.js"),
    import("wasm-feature-detect"),
  ])
  const corePath = (await simd()) ? coreSimdUrl : coreUrl
  const worker = await createWorker(LANGUAGES, OEM.LSTM_ONLY, {
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
  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK })
    return worker
  } catch (error) {
    await worker.terminate()
    throw error
  }
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

function ocrScale(width: number, height: number): number {
  const longestSide = Math.max(width, height)
  return Math.min(MAX_OCR_SIDE / longestSide, Math.max(1, MIN_OCR_SIDE / longestSide))
}

async function drawForOcr(bitmap: ImageBitmap): Promise<Blob | null> {
  const scale = ocrScale(bitmap.width, bitmap.height)
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

function decodeOriented(image: Blob): Promise<ImageBitmap | null> {
  return createImageBitmap(image, { imageOrientation: "from-image" }).catch(() => null)
}

async function decodeBest(source: Blob | null, prepared: Blob): Promise<ImageBitmap | null> {
  const fullResolution = source ? await decodeOriented(source) : null
  return fullResolution ?? decodeOriented(prepared)
}

async function preprocess({ bytes, mime, source }: OcrImage): Promise<Blob> {
  const prepared = new Blob([bytes as BlobPart], { type: mime })
  if (typeof createImageBitmap !== "function") return prepared
  const bitmap = await decodeBest(source, prepared)
  if (!bitmap) return prepared
  try {
    return (await drawForOcr(bitmap)) ?? prepared
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
  image: OcrImage,
  options: RecognizeReceiptOptions = {},
): Promise<RecognizedReceipt> {
  if (!isOcrSupported(image.mime)) throw new Error("Seules les photos peuvent être lues")
  const { onProgress, signal } = options
  if (signal?.aborted) throw abortError()
  clearIdleTimer()
  activeJobs += 1
  const listener = onProgress ?? null
  progressListener = listener
  try {
    const preprocessed = await preprocess(image)
    if (signal?.aborted) throw abortError()
    const rawText = await recognizeText(preprocessed, signal)
    return { ...parseReceiptText(rawText), rawText }
  } finally {
    activeJobs -= 1
    if (progressListener === listener) progressListener = null
    if (activeJobs === 0 && workerPromise) scheduleIdleTermination()
  }
}
