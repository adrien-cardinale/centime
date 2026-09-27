import { resolveDatabaseUrl } from "@centime/db"
import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { defaultStaticDir, projectRoot } from "./paths"

export type Config = {
  port: number
  databaseUrl: string
  appPassword: string
  sessionSecret: string
  staticDir: string
  isProduction: boolean
}

export class ConfigError extends Error {}

function loadDotEnv(): void {
  const envFile = resolve(projectRoot, ".env")
  if (existsSync(envFile)) process.loadEnvFile(envFile)
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new ConfigError(`La variable d'environnement ${name} est obligatoire.`)
  return value
}

function parsePort(value: string | undefined): number {
  const port = Number(value ?? "3000")
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new ConfigError(`PORT invalide : ${value}`)
  }
  return port
}

function optionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value ? value : undefined
}

export function loadConfig(): Config {
  loadDotEnv()
  const staticDir = optionalEnv("STATIC_DIR")
  return {
    port: parsePort(optionalEnv("PORT")),
    databaseUrl: resolveDatabaseUrl(optionalEnv("DATABASE_URL") ?? "file:./data/centime.db", projectRoot),
    appPassword: requireEnv("APP_PASSWORD"),
    sessionSecret: requireEnv("SESSION_SECRET"),
    staticDir: staticDir ? resolve(projectRoot, staticDir) : defaultStaticDir,
    isProduction: process.env.NODE_ENV === "production",
  }
}
