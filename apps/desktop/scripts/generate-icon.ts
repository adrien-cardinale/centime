import { writeFileSync } from "node:fs"
import { deflateSync } from "node:zlib"

const SIZE = 512
const BACKGROUND = [24, 24, 27, 255] as const
const FOREGROUND = [244, 244, 245, 255] as const
const CORNER_RADIUS = 96
const RING_RADIUS = 120
const RING_THICKNESS = 34
const OPENING_HALF_ANGLE = Math.PI / 4
const STEM_HALF_WIDTH = 16
const STEM_HALF_HEIGHT = 180

type Rgba = readonly [number, number, number, number]

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  return value >>> 0
})

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Uint8Array): Buffer {
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data])
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(typeAndData))
  return Buffer.concat([length, typeAndData, checksum])
}

function insideRoundedSquare(x: number, y: number): boolean {
  const dx = Math.max(CORNER_RADIUS - x, x - (SIZE - 1 - CORNER_RADIUS), 0)
  const dy = Math.max(CORNER_RADIUS - y, y - (SIZE - 1 - CORNER_RADIUS), 0)
  return dx * dx + dy * dy <= CORNER_RADIUS * CORNER_RADIUS
}

function onCentSign(x: number, y: number): boolean {
  const dx = x - SIZE / 2
  const dy = y - SIZE / 2
  const distance = Math.hypot(dx, dy)
  const onRing = Math.abs(distance - RING_RADIUS) <= RING_THICKNESS / 2
  const opening = dx > 0 && Math.abs(Math.atan2(dy, dx)) < OPENING_HALF_ANGLE
  const onStem = Math.abs(dx) <= STEM_HALF_WIDTH && Math.abs(dy) <= STEM_HALF_HEIGHT
  return (onRing && !opening) || onStem
}

function pixelAt(x: number, y: number): Rgba {
  if (!insideRoundedSquare(x, y)) return [0, 0, 0, 0]
  return onCentSign(x, y) ? FOREGROUND : BACKGROUND
}

function imageData(): Buffer {
  const rowLength = SIZE * 4 + 1
  const raw = Buffer.alloc(rowLength * SIZE)
  for (let y = 0; y < SIZE; y += 1) {
    raw[y * rowLength] = 0
    for (let x = 0; x < SIZE; x += 1) raw.set(pixelAt(x, y), y * rowLength + 1 + x * 4)
  }
  return raw
}

function png(): Buffer {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(SIZE, 0)
  header.writeUInt32BE(SIZE, 4)
  header.set([8, 6, 0, 0, 0], 8)
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  return Buffer.concat([
    signature,
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(imageData())),
    chunk("IEND", Buffer.alloc(0)),
  ])
}

const output = process.argv[2] ?? new URL("../src-tauri/icons/icon.png", import.meta.url).pathname
writeFileSync(output, png())
