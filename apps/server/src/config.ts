import { isAbsolute, resolve } from "node:path"
import { defaultStaticDir, projectRoot } from "./paths"

export type Config = {
  port: number
  databasePath: string
  allowSignup: boolean
  staticDir: string
  isProduction: boolean
  maxUserBytes: number | undefined
  rateLimitPerMinute: number
}

const DEFAULT_RATE_LIMIT_PER_MINUTE = 300

export class ConfigError extends Error {}

function optionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value ? value : undefined
}

function parsePort(value: string | undefined): number {
  const port = Number(value ?? "3000")
  if (!Number.isInteger(port) || port <= 0 || port > 65535) throw new ConfigError(`PORT invalide : ${value}`)
  return port
}

function parseBoolean(name: string, value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback
  if (value === "true") return true
  if (value === "false") return false
  throw new ConfigError(`${name} doit valoir true ou false : ${value}`)
}

export function resolveDatabasePath(path: string): string {
  return isAbsolute(path) ? path : resolve(projectRoot, path)
}

function parseNonNegativeInt(name: string, value: string | undefined): number | undefined {
  if (value === undefined) return undefined
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) throw new ConfigError(`${name} doit être un entier positif ou nul : ${value}`)
  return parsed
}


export function loadConfig(): Config {
  const staticDir = optionalEnv("STATIC_DIR")
  return {
    port: parsePort(optionalEnv("PORT")),
    databasePath: resolveDatabasePath(optionalEnv("DATABASE_PATH") ?? "./data/relay.db"),
    allowSignup: parseBoolean("ALLOW_SIGNUP", optionalEnv("ALLOW_SIGNUP"), true),
    staticDir: staticDir ? resolve(projectRoot, staticDir) : defaultStaticDir,
    isProduction: process.env.NODE_ENV === "production",
    maxUserBytes: parseNonNegativeInt("MAX_USER_BYTES", optionalEnv("MAX_USER_BYTES")),
    rateLimitPerMinute:
      parseNonNegativeInt("RATE_LIMIT_PER_MINUTE", optionalEnv("RATE_LIMIT_PER_MINUTE")) ?? DEFAULT_RATE_LIMIT_PER_MINUTE,
  }
}
