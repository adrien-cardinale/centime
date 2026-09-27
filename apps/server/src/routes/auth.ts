import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import { z } from "zod"
import { passwordMatches } from "../auth/password"
import { type AuthDeps, createSession, destroySession, hasValidSession } from "../auth/session"

const loginSchema = z.object({ password: z.string().min(1) })

export function createAuthRoutes(deps: AuthDeps) {
  return new Hono()
    .post("/login", zValidator("json", loginSchema), async (c) => {
      const { password } = c.req.valid("json")
      if (!passwordMatches(password, deps.config.appPassword)) {
        return c.json({ error: "Mot de passe incorrect" }, 401)
      }
      await createSession(c, deps)
      return c.json({ authenticated: true }, 200)
    })
    .post("/logout", async (c) => {
      await destroySession(c, deps)
      return c.json({ authenticated: false }, 200)
    })
    .get("/me", async (c) => c.json({ authenticated: await hasValidSession(c, deps) }, 200))
}
