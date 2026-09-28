import { zValidator } from "@hono/zod-validator"
import type { Context, ValidationTargets } from "hono"
import { z } from "zod"

type IssueList = { issues: readonly { message: string }[] }
type ValidationOutcome = { success: true } | { success: false; error: IssueList }

const INVALID_REQUEST = "Requête invalide"

export const idParamSchema = z.object({ id: z.string().min(1) })
export const isoDateParam = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide (AAAA-MM-JJ)")

function rejectInvalid(result: ValidationOutcome, c: Context) {
  if (!result.success) return c.json({ error: result.error.issues[0]?.message ?? INVALID_REQUEST }, 400)
}

export function validated<Target extends keyof ValidationTargets, Schema extends z.ZodType>(target: Target, schema: Schema) {
  return zValidator(target, schema, rejectInvalid)
}
