import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { loadEnvFile, parseEnvFile } from "./env-file"

describe("parseEnvFile", () => {
  it("reads KEY=value lines and skips comments and blank lines", () => {
    const entries = parseEnvFile("# commentaire\n\nPORT=3000\r\n  APP_PASSWORD = secret  \nINVALID\n=vide\n")
    expect(Object.fromEntries(entries)).toEqual({ PORT: "3000", APP_PASSWORD: "secret" })
  })

  it("removes matching single or double quotes", () => {
    const entries = parseEnvFile(`A="double quoted"\nB='single quoted'\nC="unbalanced'\nD=a=b\nE=\n`)
    expect(Object.fromEntries(entries)).toEqual({
      A: "double quoted",
      B: "single quoted",
      C: `"unbalanced'`,
      D: "a=b",
      E: "",
    })
  })
})

describe("loadEnvFile", () => {
  let folder: string

  beforeEach(() => {
    folder = mkdtempSync(join(tmpdir(), "centime-env-"))
  })

  afterEach(() => {
    rmSync(folder, { recursive: true, force: true })
  })

  it("adds missing variables without overwriting defined ones", () => {
    const file = join(folder, ".env")
    writeFileSync(file, "PORT=4000\nAPP_PASSWORD='from-file'\nEMPTY_DEFINED=from-file\n")
    const env: NodeJS.ProcessEnv = { PORT: "3000", EMPTY_DEFINED: "" }
    loadEnvFile(file, env)
    expect(env).toEqual({ PORT: "3000", APP_PASSWORD: "from-file", EMPTY_DEFINED: "" })
  })

  it("ignores a missing file", () => {
    const env: NodeJS.ProcessEnv = {}
    loadEnvFile(join(folder, "absent.env"), env)
    expect(env).toEqual({})
  })
})
