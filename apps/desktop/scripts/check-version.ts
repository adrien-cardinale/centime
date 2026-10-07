import { readFileSync } from "node:fs"

const root = new URL("../", import.meta.url)
const read = (path: string) => readFileSync(new URL(path, root), "utf8")

const tauriConf = JSON.parse(read("src-tauri/tauri.conf.json")).version
const packageJson = JSON.parse(read("package.json")).version
const cargoToml = read("src-tauri/Cargo.toml").match(/^version = "([^"]+)"/m)?.[1]
const cargoLock = read("src-tauri/Cargo.lock").match(/name = "centime-desktop"\nversion = "([^"]+)"/)?.[1]

const versions: Record<string, string | undefined> = {
  "tauri.conf.json": tauriConf,
  "package.json": packageJson,
  "Cargo.toml": cargoToml,
  "Cargo.lock": cargoLock,
}

const tag = process.argv[2]?.replace(/^v/, "")
if (tag !== undefined) versions["tag"] = tag

const distinct = new Set(Object.values(versions))
if (distinct.size > 1 || distinct.has(undefined)) {
  console.error("Inconsistent versions:")
  for (const [file, version] of Object.entries(versions)) console.error(`  ${file}: ${version ?? "not found"}`)
  process.exit(1)
}
console.log(`Version ${[...distinct][0]} is consistent`)
