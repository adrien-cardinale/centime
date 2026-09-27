import { z } from "zod"
import { regexError } from "./rules"
import { RULE_FIELDS, RULE_MATCH_KINDS } from "./types"

export const RULE_PRIORITY_MIN = -1000
export const RULE_PRIORITY_MAX = 1000

const ruleMatcherFields = {
  pattern: z.string().trim().min(1, "Le motif est obligatoire"),
  matchKind: z.enum(RULE_MATCH_KINDS),
  field: z.enum(RULE_FIELDS),
}

type RuleMatcherShape = { pattern: string; matchKind: (typeof RULE_MATCH_KINDS)[number] }

function checkRegex(value: RuleMatcherShape, context: z.RefinementCtx): void {
  if (value.matchKind !== "regex") return
  const error = regexError(value.pattern)
  if (error !== null) {
    context.addIssue({ code: "custom", path: ["pattern"], message: `Expression régulière invalide : ${error}` })
  }
}

export const ruleMatcherSchema = z.object(ruleMatcherFields).superRefine(checkRegex)

export const rulePayloadSchema = z
  .object({
    ...ruleMatcherFields,
    categoryId: z.string().min(1).nullable(),
    fixedItemId: z.string().min(1).nullable().optional(),
    markAsTransfer: z.boolean(),
    priority: z
      .number()
      .int("Priorité entière attendue")
      .min(RULE_PRIORITY_MIN, `Priorité minimale : ${RULE_PRIORITY_MIN}`)
      .max(RULE_PRIORITY_MAX, `Priorité maximale : ${RULE_PRIORITY_MAX}`),
  })
  .superRefine(checkRegex)
  .refine((rule) => rule.categoryId !== null || Boolean(rule.fixedItemId) || rule.markAsTransfer, {
    path: ["categoryId"],
    message: "Choisissez une catégorie ou marquez comme transfert",
  })

export type RuleMatcherInput = z.infer<typeof ruleMatcherSchema>
export type RulePayload = z.infer<typeof rulePayloadSchema>
