import { existsSync, readFileSync } from "node:fs"

const QUOTES = ['"', "'"]

function unquote(value: string): string {
  const first = value.at(0)
  if (value.length >= 2 && first !== undefined && QUOTES.includes(first) && value.endsWith(first)) {
    return value.slice(1, -1)
  }
  return value
}

export function parseEnvFile(content: string): Map<string, string> {
  const entries = new Map<string, string>()
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue
    const separator = line.indexOf("=")
    if (separator <= 0) continue
    const key = line.slice(0, separator).trim()
    entries.set(key, unquote(line.slice(separator + 1).trim()))
  }
  return entries
}

export function loadEnvFile(path: string, env: NodeJS.ProcessEnv = process.env): void {
  if (!existsSync(path)) return
  for (const [key, value] of parseEnvFile(readFileSync(path, "utf8"))) {
    if (env[key] === undefined) env[key] = value
  }
}
