import { z } from "zod"
import { isoDateSchema } from "./iso-date"
import { ruleMatcherSchema } from "./rule-payload"
import { BUDGET_KINDS, PERIODICITIES } from "./types"

export const budgetPayloadSchema = z
  .object({
    kind: z.enum(BUDGET_KINDS, { error: "Type invalide" }).default("envelope"),
    categoryId: z.string({ error: "Choisissez une catégorie" }).min(1, "Choisissez une catégorie"),
    amount: z
      .number({ error: "Montant invalide" })
      .refine(Number.isFinite, "Montant invalide")
      .refine((amount) => amount > 0, "Le montant doit être supérieur à zéro"),
    period: z.enum(PERIODICITIES, { error: "Périodicité invalide" }),
    rollover: z.boolean({ error: "Report invalide" }),
    startDate: isoDateSchema,
    rule: ruleMatcherSchema.nullable().optional(),
  })
  .refine((payload) => payload.kind === "envelope" || !payload.rollover, {
    path: ["rollover"],
    message: "Pas de report pour un revenu",
  })

export type BudgetPayload = z.infer<typeof budgetPayloadSchema>
export type BudgetPayloadInput = z.input<typeof budgetPayloadSchema>
