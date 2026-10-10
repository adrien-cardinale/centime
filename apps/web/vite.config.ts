import tailwindcss from "@tailwindcss/vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import react from "@vitejs/plugin-react"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"

const DESKTOP_MODE = "desktop"
const API_PROXY = { "/api": "http://localhost:3000" }
const MOBILE_HMR_PORT = 5175

// La version affichée est celle de la release, déclarée une seule fois côté desktop (Tauri la lit dans Cargo.toml).
const { version } = JSON.parse(readFileSync(new URL("../desktop/package.json", import.meta.url), "utf8")) as { version: string }

export default defineConfig(({ mode }) => {
  const desktop = mode === DESKTOP_MODE
  const mobileHost = process.env.TAURI_DEV_HOST
  return {
    define: {
      __APP_VERSION__: JSON.stringify(version),
    },
    plugins: [tanstackRouter({ target: "react", autoCodeSplitting: true }), react(), tailwindcss()],
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
