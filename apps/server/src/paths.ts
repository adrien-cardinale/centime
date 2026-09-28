import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

const serverRoot = fileURLToPath(new URL("..", import.meta.url))

export const projectRoot = resolve(serverRoot, "../..")
export const defaultStaticDir = resolve(projectRoot, "apps/web/dist")
