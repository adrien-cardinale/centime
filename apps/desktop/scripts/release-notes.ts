import { readFileSync } from "node:fs"

// Extrait du CHANGELOG.md la section de la version donnée (tag "vX.Y.Z" ou "X.Y.Z"),
// pour l'attacher comme notes de release. Échoue si la section manque : le job
// check-version l'exécute pour bloquer un tag sans changelog.
const version = process.argv[2]?.replace(/^v/, "")
if (!version) {
  console.error("Usage: bun release-notes.ts <tag>")
  process.exit(1)
}

const changelog = readFileSync(new URL("../../../CHANGELOG.md", import.meta.url), "utf8")
const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const match = changelog.match(new RegExp(`^## \\[${escaped}\\][^\\n]*\\n([\\s\\S]*?)(?=^## \\[|$(?![\\s\\S]))`, "m"))
if (!match) {
  console.error(`No "## [${version}]" section found in CHANGELOG.md`)
  process.exit(1)
}
console.log(match[1].trim())
