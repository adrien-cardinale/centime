#!/usr/bin/env bun
// Audit préalable à une release : rassemble en un seul passage ce qu'il faut savoir avant de
// décider du numéro de version et de toucher au changelog, à la doc et aux captures.
// Lecture seule : le script ne modifie rien, il signale.
//
// Usage : bun .claude/skills/release/scripts/release-audit.ts [version-cible]

import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"

const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8" }).trim()
const root = git("rev-parse", "--show-toplevel")
const read = (path: string) => readFileSync(`${root}/${path}`, "utf8")

const section = (title: string) => console.log(`\n=== ${title}\n`)

// --- Versions -----------------------------------------------------------------------------------
// Les trois fichiers doivent coïncider : le job check-version du workflow refuse le tag sinon.
const packageJson = JSON.parse(read("apps/desktop/package.json")).version as string
const cargoPackage = read("apps/desktop/src-tauri/Cargo.toml").split(/^\[/m).find((s) => s.startsWith("package]")) ?? ""
const cargoToml = cargoPackage.match(/^version = "([^"]+)"/m)?.[1]
const cargoLock = read("apps/desktop/src-tauri/Cargo.lock").match(/name = "centime-desktop"\r?\nversion = "([^"]+)"/)?.[1]

section("Versions")
console.log(`apps/desktop/package.json        ${packageJson}`)
console.log(`apps/desktop/src-tauri/Cargo.toml ${cargoToml ?? "introuvable"}`)
console.log(`apps/desktop/src-tauri/Cargo.lock ${cargoLock ?? "introuvable"}`)
const consistent = new Set([packageJson, cargoToml, cargoLock]).size === 1
console.log(consistent ? "→ cohérentes" : "→ INCOHÉRENTES : à aligner avant de taguer")

const target = process.argv[2]?.replace(/^v/, "")
if (target) console.log(`version cible demandée : ${target}`)

// --- Historique depuis le dernier tag -----------------------------------------------------------
const tags = git("tag", "--sort=-v:refname").split("\n").filter(Boolean)
const lastTag = tags[0]

section(`Commits depuis ${lastTag ?? "le début"}`)
const range = lastTag ? `${lastTag}..HEAD` : "HEAD"
const log = git("log", "--oneline", range)
console.log(log || "(aucun)")

section("Zones touchées depuis ce tag")
const changed = lastTag ? git("diff", "--name-only", range).split("\n").filter(Boolean) : []
const areas = new Map<string, number>()
for (const file of changed) {
  const area = file.split("/").slice(0, 3).join("/")
  areas.set(area, (areas.get(area) ?? 0) + 1)
}
for (const [area, count] of [...areas].sort((a, b) => b[1] - a[1])) console.log(`${String(count).padStart(4)}  ${area}`)
if (!changed.length) console.log("(aucun fichier modifié, ou pas de tag de référence)")

// --- Captures d'écran ---------------------------------------------------------------------------
// Une capture est suspecte si du code de l'écran qu'elle montre a bougé après son dernier commit.
// Le verdict reste humain : un refactor interne ne change pas forcément l'image.
const screens: Record<string, string[]> = {
  dashboard: ["apps/web/src/components/dashboard", "apps/web/src/routes/_app/index.tsx"],
  budgets: ["apps/web/src/components/budgets", "apps/web/src/components/fixed-items", "apps/web/src/routes/_app/budgets.tsx"],
  transactions: ["apps/web/src/components/transactions", "apps/web/src/routes/_app/transactions.tsx"],
  import: ["apps/web/src/components/import", "apps/web/src/routes/_app/import.tsx"],
  categories: ["apps/web/src/components/categories", "apps/web/src/components/rules", "apps/web/src/routes/_app/categories.tsx"],
  onboarding: ["apps/web/src/components/startup"],
}
// Le châssis commun (barre latérale, en-têtes, primitives UI, thème) se voit sur toutes les captures.
const shared = [
  "apps/web/src/components/app-sidebar.tsx",
  "apps/web/src/components/page-header.tsx",
  "apps/web/src/components/ui",
  "apps/web/src/index.css",
]

// Les modifications non committées comptent aussi : elles partiront dans la release.
const pending = git("status", "--porcelain").split("\n").map((line) => line.slice(3).trim()).filter(Boolean)

section("Captures d'écran")
for (const [screen, paths] of Object.entries(screens)) {
  const shots = [`site/screenshots/${screen}-light.webp`, `site/screenshots/${screen}-dark.webp`]
  const shotDate = shots
    .map((shot) => git("log", "-1", "--format=%cI", "--", shot))
    .filter(Boolean)
    .sort()
    .at(-1)
  if (!shotDate) {
    console.log(`${screen.padEnd(13)} capture absente de git`)
    continue
  }
  const since = [...paths, ...shared]
    .flatMap((path) => git("log", `--since=${shotDate}`, "--format=%h %cs %s", "--", path).split("\n"))
    .filter(Boolean)
  const unique = [...new Set(since)]
  const dirty = pending.filter((file) => [...paths, ...shared].some((path) => file.startsWith(path)))
  const stamp = shotDate.slice(0, 10)
  if (!unique.length && !dirty.length) {
    console.log(`${screen.padEnd(13)} ${stamp}  à jour`)
    continue
  }
  console.log(`${screen.padEnd(13)} ${stamp}  ${unique.length} commit(s) + ${dirty.length} fichier(s) non committé(s) depuis :`)
  for (const commit of unique.slice(0, 6)) console.log(`              - ${commit}`)
  for (const file of dirty.slice(0, 6)) console.log(`              - (non committé) ${file}`)
}

// --- Parité des traductions ---------------------------------------------------------------------
// Une clé présente d'un seul côté se voit dans l'UI : autant la corriger avant la release.
const flatten = (value: unknown, prefix = ""): string[] =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? Object.entries(value).flatMap(([key, child]) => flatten(child, `${prefix}${key}.`))
    : [prefix.slice(0, -1)]

section("Traductions (en / fr)")
const en = new Set(flatten(JSON.parse(read("apps/web/src/i18n/locales/en.json"))))
const fr = new Set(flatten(JSON.parse(read("apps/web/src/i18n/locales/fr.json"))))
const missingFr = [...en].filter((key) => !fr.has(key))
const missingEn = [...fr].filter((key) => !en.has(key))
console.log(`en: ${en.size} clés, fr: ${fr.size} clés`)
if (missingFr.length) console.log(`manquantes en fr : ${missingFr.join(", ")}`)
if (missingEn.length) console.log(`manquantes en en : ${missingEn.join(", ")}`)
if (!missingFr.length && !missingEn.length) console.log("→ à parité")

// --- Changelog ----------------------------------------------------------------------------------
section("Changelog")
const changelog = read("CHANGELOG.md")
const versionToCheck = target ?? packageJson
const heading = changelog.match(new RegExp(`^## \\[${versionToCheck.replace(/\./g, "\\.")}\\][^\\n]*`, "m"))?.[0]
console.log(heading ? `section trouvée : ${heading}` : `pas de section "## [${versionToCheck}]" → le tag échouerait en CI`)
const today = new Date().toISOString().slice(0, 10)
if (heading && !heading.includes(today)) console.log(`date de la section différente d'aujourd'hui (${today}) : à vérifier`)
console.log(`\nsections existantes : ${[...changelog.matchAll(/^## \[([^\]]+)\]/gm)].map((m) => m[1]).join(", ")}`)

// --- État du dépôt ------------------------------------------------------------------------------
section("État du dépôt")
console.log(`branche : ${git("rev-parse", "--abbrev-ref", "HEAD")}`)
const status = git("status", "--porcelain")
console.log(status ? status : "arbre propre")
