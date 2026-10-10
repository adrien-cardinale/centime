export type CropRect = { x: number; y: number; width: number; height: number }

export type CropCorner = "topLeft" | "topRight" | "bottomLeft" | "bottomRight"

export const FULL_CROP: CropRect = { x: 0, y: 0, width: 1, height: 1 }
export const MIN_CROP_SIZE = 0.05

const BRIGHT_LINE_RATIO = 0.2
const MIN_BOX_AREA = 0.1
const MAX_BOX_AREA = 0.95
const MIN_BOX_FILL = 0.5
const MIN_CONTRAST = 40
const BOX_MARGIN = 0.02
const LEVELS = 256

type Edges = { left: number; top: number; right: number; bottom: number }

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function toEdges(rect: CropRect): Edges {
  return { left: rect.x, top: rect.y, right: rect.x + rect.width, bottom: rect.y + rect.height }
}

function fromEdges(edges: Edges): CropRect {
  return { x: edges.left, y: edges.top, width: edges.right - edges.left, height: edges.bottom - edges.top }
}

export function isFullCrop(rect: CropRect): boolean {
  return rect.x === 0 && rect.y === 0 && rect.width === 1 && rect.height === 1
}

export function clampCrop(rect: CropRect): CropRect {
  const left = clamp(rect.x, 0, 1)
  const top = clamp(rect.y, 0, 1)
  return fromEdges({
    left,
    top,
    right: clamp(rect.x + rect.width, left, 1),
    bottom: clamp(rect.y + rect.height, top, 1),
  })
}

export function moveCrop(rect: CropRect, dx: number, dy: number): CropRect {
  return {
    ...rect,
    x: clamp(rect.x + dx, 0, 1 - rect.width),
    y: clamp(rect.y + dy, 0, 1 - rect.height),
  }
}

function isLeft(corner: CropCorner): boolean {
  return corner === "topLeft" || corner === "bottomLeft"
}

function isTop(corner: CropCorner): boolean {
  return corner === "topLeft" || corner === "topRight"
}

export function resizeCrop(rect: CropRect, corner: CropCorner, dx: number, dy: number): CropRect {
  const edges = toEdges(rect)
  if (isLeft(corner)) edges.left = clamp(edges.left + dx, 0, edges.right - MIN_CROP_SIZE)
  else edges.right = clamp(edges.right + dx, edges.left + MIN_CROP_SIZE, 1)
  if (isTop(corner)) edges.top = clamp(edges.top + dy, 0, edges.bottom - MIN_CROP_SIZE)
  else edges.bottom = clamp(edges.bottom + dy, edges.top + MIN_CROP_SIZE, 1)
  return fromEdges(edges)
}

function histogram(luminance: ArrayLike<number>): number[] {
  const counts = new Array<number>(LEVELS).fill(0)
  for (let index = 0; index < luminance.length; index += 1) {
    const level = clamp(Math.round(luminance[index] ?? 0), 0, LEVELS - 1)
    counts[level] = (counts[level] ?? 0) + 1
  }
  return counts
}

export function otsuThreshold(luminance: ArrayLike<number>): number {
  const counts = histogram(luminance)
  const total = luminance.length
  const weightedSum = counts.reduce((sum, count, level) => sum + count * level, 0)
  let backgroundCount = 0
  let backgroundSum = 0
  let bestVariance = -1
  let bestThreshold = 0
  for (let level = 0; level < LEVELS; level += 1) {
    backgroundCount += counts[level] ?? 0
    backgroundSum += (counts[level] ?? 0) * level
    const foregroundCount = total - backgroundCount
    if (backgroundCount === 0 || foregroundCount === 0) continue
    const meanGap = backgroundSum / backgroundCount - (weightedSum - backgroundSum) / foregroundCount
    const variance = backgroundCount * foregroundCount * meanGap * meanGap
    if (variance > bestVariance) {
      bestVariance = variance
      bestThreshold = level + 1
    }
  }
  return bestThreshold
}

function contrast(luminance: ArrayLike<number>): number {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (let index = 0; index < luminance.length; index += 1) {
    const value = luminance[index] ?? 0
    min = Math.min(min, value)
    max = Math.max(max, value)
  }
  return max - min
}

type BrightMap = { bright: Uint8Array; rows: number[]; columns: number[] }

function brightMap(luminance: ArrayLike<number>, width: number, height: number): BrightMap {
  const threshold = otsuThreshold(luminance)
  const bright = new Uint8Array(width * height)
  const rows = new Array<number>(height).fill(0)
  const columns = new Array<number>(width).fill(0)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if ((luminance[y * width + x] ?? 0) < threshold) continue
      bright[y * width + x] = 1
      rows[y] = (rows[y] ?? 0) + 1
      columns[x] = (columns[x] ?? 0) + 1
    }
  }
  return { bright, rows, columns }
}

function brightSpan(counts: number[], lineLength: number): { first: number; last: number } | null {
  const minCount = lineLength * BRIGHT_LINE_RATIO
  const first = counts.findIndex((count) => count >= minCount)
  if (first === -1) return null
  return { first, last: counts.findLastIndex((count) => count >= minCount) }
}

function brightRatio(map: BrightMap, width: number, box: Edges): number {
  let count = 0
  for (let y = box.top; y <= box.bottom; y += 1) {
    for (let x = box.left; x <= box.right; x += 1) count += map.bright[y * width + x] ?? 0
  }
  return count / ((box.right - box.left + 1) * (box.bottom - box.top + 1))
}

function withMargin(rect: CropRect): CropRect {
  return clampCrop({
    x: rect.x - BOX_MARGIN,
    y: rect.y - BOX_MARGIN,
    width: rect.width + 2 * BOX_MARGIN,
    height: rect.height + 2 * BOX_MARGIN,
  })
}

export function findReceiptBounds(luminance: ArrayLike<number>, width: number, height: number): CropRect | null {
  if (width <= 0 || height <= 0 || luminance.length !== width * height) return null
  if (contrast(luminance) < MIN_CONTRAST) return null
  const map = brightMap(luminance, width, height)
  const rows = brightSpan(map.rows, width)
  const columns = brightSpan(map.columns, height)
  if (!rows || !columns) return null
  const box = { left: columns.first, top: rows.first, right: columns.last, bottom: rows.last }
  const rect: CropRect = {
    x: box.left / width,
    y: box.top / height,
    width: (box.right - box.left + 1) / width,
    height: (box.bottom - box.top + 1) / height,
  }
  const area = rect.width * rect.height
  if (area < MIN_BOX_AREA || area > MAX_BOX_AREA) return null
  if (brightRatio(map, width, box) < MIN_BOX_FILL) return null
  return withMargin(rect)
}
