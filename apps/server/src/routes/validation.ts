import { zValidator } from "@hono/zod-validator"
import type { Context, ValidationTargets } from "hono"
import type { z } from "zod"

type IssueList = { issues: readonly { message: string }[] }
type ValidationOutcome = { success: true } | { success: false; error: IssueList }

const INVALID_REQUEST = "Requête invalide"

function rejectInvalid(result: ValidationOutcome, c: Context) {
  if (!result.success) return c.json({ error: result.error.issues[0]?.message ?? INVALID_REQUEST }, 400)
}

export function validated<Target extends keyof ValidationTargets, Schema extends z.ZodType>(target: Target, schema: Schema) {
  return zValidator(target, schema, rejectInvalid)
}
