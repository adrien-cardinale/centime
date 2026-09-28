import { ServiceError } from "@centime/services"
import type { Context } from "hono"
import { HTTPException } from "hono/http-exception"

const INTERNAL_ERROR = "Erreur interne du serveur"

export function handleError(error: Error, c: Context) {
  if (error instanceof ServiceError) return c.json({ error: error.message }, error.status)
  if (error instanceof HTTPException) return error.getResponse()
  console.error(error)
  return c.json({ error: INTERNAL_ERROR }, 500)
}
