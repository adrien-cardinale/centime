import { mkdirSync } from "node:fs"
import { dirname, isAbsolute, resolve } from "node:path"

const FILE_PREFIX = "file:"

export function resolveDatabaseUrl(url: string, baseDir: string): string {
  if (!url.startsWith(FILE_PREFIX)) return url
  const filePath = url.slice(FILE_PREFIX.length)
  const absolutePath = isAbsolute(filePath) ? filePath : resolve(baseDir, filePath)
  mkdirSync(dirname(absolutePath), { recursive: true })
  return `${FILE_PREFIX}${absolutePath}`
}
