import { createApiToken, listApiTokens, revokeApiToken } from "@centime/services"
import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import { createMiddleware } from "hono/factory"
import { z } from "zod"
import { passwordMatches } from "../auth/password"
import { type AuthDeps, createSession, destroySession, hasValidSession } from "../auth/session"
import { idParamSchema, validated } from "./validation"

const WRONG_PASSWORD = "Mot de passe incorrect"

const loginSchema = z.object({ password: z.string().min(1) })
const tokenRequestSchema = z.object({
  password: z.string().min(1),
  label: z.string().trim().min(1, "Le libellé est obligatoire").max(100, "Libellé trop long"),
})

function requireSessionCookie(deps: AuthDeps) {
  return createMiddleware(async (c, next) => {
    if (!(await hasValidSession(c, deps))) return c.json({ error: "Session requise" }, 401)
    await next()
  })
}

export function createAuthRoutes(deps: AuthDeps) {
  const sessionOnly = requireSessionCookie(deps)
  return new Hono()
    .post("/login", zValidator("json", loginSchema), async (c) => {
      const { password } = c.req.valid("json")
      if (!passwordMatches(password, deps.config.appPassword)) {
        return c.json({ error: WRONG_PASSWORD }, 401)
      }
      await createSession(c, deps)
      return c.json({ authenticated: true }, 200)
    })
    .post("/logout", async (c) => {
      await destroySession(c, deps)
      return c.json({ authenticated: false }, 200)
    })
    .get("/me", async (c) => c.json({ authenticated: await hasValidSession(c, deps) }, 200))
    .post("/token", validated("json", tokenRequestSchema), async (c) => {
      const { password, label } = c.req.valid("json")
      if (!passwordMatches(password, deps.config.appPassword)) return c.json({ error: WRONG_PASSWORD }, 401)
      return c.json(await createApiToken(deps.db, { label }), 201)
    })
    .get("/tokens", sessionOnly, async (c) => c.json(await listApiTokens(deps.db), 200))
    .delete("/tokens/:id", sessionOnly, validated("param", idParamSchema), async (c) =>
      c.json(await revokeApiToken(deps.db, c.req.valid("param")), 200),
    )
}
