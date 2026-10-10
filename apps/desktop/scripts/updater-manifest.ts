import { readdirSync, readFileSync } from "node:fs"
import { basename, join } from "node:path"

// Construit le latest.json que le plugin updater de Tauri interroge : pour chaque cible, l'URL de
// l'asset de la release et la signature émise à la compilation (fichier .sig à côté de l'installateur).
const [tag, artifactsDir, notesPath] = process.argv.slice(2)
if (!tag || !artifactsDir) {
  console.error("Usage: bun updater-manifest.ts <tag> <artifacts-dir> [notes-file]")
  process.exit(1)
}

const repository = process.env.GITHUB_REPOSITORY ?? "adrien-cardinale/centime"

// macOS est construit en binaire universel : la même archive sert aux deux architectures.
const TARGETS: { suffix: string; platforms: string[] }[] = [
  { suffix: ".app.tar.gz.sig", platforms: ["darwin-aarch64", "darwin-x86_64"] },
  { suffix: "-setup.exe.sig", platforms: ["windows-x86_64"] },
  { suffix: ".AppImage.sig", platforms: ["linux-x86_64"] },
]

function listFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? listFiles(path) : [path]
  })
}

const signatures = listFiles(artifactsDir).filter((path) => path.endsWith(".sig"))
const platforms: Record<string, { signature: string; url: string }> = {}
const missing: string[] = []

for (const { suffix, platforms: names } of TARGETS) {
  const signaturePath = signatures.find((path) => path.endsWith(suffix))
  if (!signaturePath) {
    missing.push(suffix)
    continue
  }
  const asset = basename(signaturePath).replace(/\.sig$/, "")
  const entry = {
    signature: readFileSync(signaturePath, "utf8").trim(),
    url: `https://github.com/${repository}/releases/download/${tag}/${asset}`,
  }
  for (const name of names) platforms[name] = entry
}

if (missing.length > 0) {
  console.error(`Signatures manquantes (${missing.join(", ")}) : la mise à jour serait muette sur ces plateformes.`)
  process.exit(1)
}

console.log(
  JSON.stringify(
    {
      version: tag.replace(/^v/, ""),
      notes: notesPath ? readFileSync(notesPath, "utf8").trim() : "",
      pub_date: new Date().toISOString(),
      platforms,
    },
    null,
    2
  )
)
