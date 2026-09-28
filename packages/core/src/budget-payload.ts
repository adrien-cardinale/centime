import { z } from "zod"
import { isoDateSchema } from "./fixed-item-payload"
import { PERIODICITIES } from "./types"

export const budgetPayloadSchema = z.object({
  categoryId: z.string({ error: "Choisissez une catégorie" }).min(1, "Choisissez une catégorie"),
  amount: z
    .number({ error: "Montant invalide" })
    .refine(Number.isFinite, "Montant invalide")
    .refine((amount) => amount > 0, "Le montant doit être supérieur à zéro"),
  period: z.enum(PERIODICITIES, { error: "Périodicité invalide" }),
  rollover: z.boolean({ error: "Report invalide" }),
  startDate: isoDateSchema,
})

export type BudgetPayload = z.infer<typeof budgetPayloadSchema>
