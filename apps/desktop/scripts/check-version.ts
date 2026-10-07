import { readFileSync } from "node:fs"

const root = new URL("../", import.meta.url)
const read = (path: string) => readFileSync(new URL(path, root), "utf8")

// tauri.conf.json ne déclare pas de version : Tauri la lit dans Cargo.toml, une source de vérité de moins.
const packageJson = JSON.parse(read("package.json")).version
const packageSection = read("src-tauri/Cargo.toml").split(/^\[/m).find((section) => section.startsWith("package]")) ?? ""
const cargoToml = packageSection.match(/^version = "([^"]+)"/m)?.[1]
const cargoLock = read("src-tauri/Cargo.lock").match(/name = "centime-desktop"\r?\nversion = "([^"]+)"/)?.[1]

const versions: Record<string, string | undefined> = {
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
