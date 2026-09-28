import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import type { Hono } from "hono"
import { serveStatic } from "hono/bun"

export function mountSpa(app: Hono, staticDir: string): void {
  const indexFile = join(staticDir, "index.html")
  if (!existsSync(indexFile)) {
    console.warn(`Build de l'interface introuvable dans ${staticDir}, seule l'API est servie.`)
    return
  }
  const indexHtml = readFileSync(indexFile, "utf8")
  app.use("*", serveStatic({ root: staticDir }))
  app.get("*", (c) => (c.req.path.startsWith("/api/") ? c.notFound() : c.html(indexHtml)))
}
