import { Hono } from "hono"
import { parseCredentials } from "../auth"
import type { Store } from "../store"

export function createAccountRoutes(store: Store) {
  return new Hono().delete("/", async (c) => {
    const credentials = await parseCredentials(c.req.header("Authorization"))
    if (!credentials || store.check(credentials.userId, credentials.secretHash) !== "ok") {
      return c.json({ error: "Identifiants invalides" }, 401)
    }
    store.deleteUser(credentials.userId)
    return c.body(null, 204)
  })
}
