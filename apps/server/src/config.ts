import { isAbsolute, resolve } from "node:path"
import { defaultStaticDir, projectRoot } from "./paths"

export type Config = {
  port: number
  databasePath: string
  allowSignup: boolean
  staticDir: string
  isProduction: boolean
}

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


export function loadConfig(): Config {
  const staticDir = optionalEnv("STATIC_DIR")
  return {
    port: parsePort(optionalEnv("PORT")),
    databasePath: resolveDatabasePath(optionalEnv("DATABASE_PATH") ?? "./data/relay.db"),
    allowSignup: parseBoolean("ALLOW_SIGNUP", optionalEnv("ALLOW_SIGNUP"), true),
    staticDir: staticDir ? resolve(projectRoot, staticDir) : defaultStaticDir,
    isProduction: process.env.NODE_ENV === "production",
  }
}
