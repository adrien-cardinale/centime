import tailwindcss from "@tailwindcss/vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import react from "@vitejs/plugin-react"
import { copyFileSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig, type Plugin } from "vite"

const DESKTOP_MODE = "desktop"
const STATIC_MODE = "static"
const API_PROXY = { "/api": "http://localhost:3000" }
const MOBILE_HMR_PORT = 5175

// La version affichée est celle de la release, déclarée une seule fois côté desktop (Tauri la lit dans Cargo.toml).
const { version } = JSON.parse(readFileSync(new URL("../desktop/package.json", import.meta.url), "utf8")) as { version: string }

// GitHub Pages sert 404.html pour toute URL inconnue : une copie de index.html y fait démarrer la SPA.
function spaFallback(): Plugin {
  let outDir = ""
  return {
    name: "spa-fallback",
    apply: "build",
    configResolved(config) {
      outDir = join(config.root, config.build.outDir)
    },
    closeBundle() {
      copyFileSync(join(outDir, "index.html"), join(outDir, "404.html"))
    },
  }
}

export default defineConfig(({ mode }) => {
  const desktop = mode === DESKTOP_MODE
  const staticSite = mode === STATIC_MODE
  const mobileHost = process.env.TAURI_DEV_HOST
  return {
    base: staticSite ? (process.env.BASE_PATH ?? "/") : "/",
    define: {
      __APP_VERSION__: JSON.stringify(version),
    },
    plugins: [
      tanstackRouter({ target: "react", autoCodeSplitting: true }),
      react(),
      tailwindcss(),
      staticSite && spaFallback(),
    ],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      proxy: desktop ? {} : API_PROXY,
      strictPort: desktop,
      host: mobileHost || false,
      hmr: mobileHost ? { protocol: "ws", host: mobileHost, port: MOBILE_HMR_PORT } : undefined,
    },
    build: {
      target: "es2022",
    },
  }
})
