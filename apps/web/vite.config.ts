import tailwindcss from "@tailwindcss/vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import react from "@vitejs/plugin-react"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"

const DESKTOP_MODE = "desktop"
const API_PROXY = { "/api": "http://localhost:3000" }
const MOBILE_HMR_PORT = 5175

export default defineConfig(({ mode }) => {
  const desktop = mode === DESKTOP_MODE
  const mobileHost = process.env.TAURI_DEV_HOST
  return {
    plugins: [tanstackRouter({ target: "react", autoCodeSplitting: true }), react(), tailwindcss()],
    define: {
      __CENTIME_DESKTOP__: JSON.stringify(desktop),
    },
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
