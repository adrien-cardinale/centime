import { isValid, parseISO } from "date-fns"
import { z } from "zod"
import { ruleMatcherSchema } from "./rule-payload"
import { PERIODICITIES, type Periodicity } from "./types"

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const MAX_DUE_MONTH: Record<Periodicity, number | null> = { monthly: null, quarterly: 3, yearly: 12 }

function isIsoDate(value: string): boolean {
  return ISO_DATE_PATTERN.test(value) && isValid(parseISO(value))
}

export const isoDateSchema = z.string().refine(isIsoDate, "Date invalide (AAAA-MM-JJ)")

type DueMonthShape = { periodicity: Periodicity; dueMonth: number | null }

function dueMonthError({ periodicity, dueMonth }: DueMonthShape): string | null {
  const maximum = MAX_DUE_MONTH[periodicity]
  if (maximum === null) return dueMonth === null ? null : "Pas de mois d'échéance pour un poste mensuel"
  if (dueMonth === null) return "Choisissez le mois d'échéance"
  return dueMonth > maximum ? `Mois d'échéance entre 1 et ${maximum}` : null
}

export const fixedItemPayloadSchema = z
  .object({
    name: z.string().trim().min(1, "Le nom est obligatoire").max(120, "Nom trop long"),
    expectedAmount: z
      .number({ error: "Montant attendu invalide" })
      .refine(Number.isFinite, "Montant attendu invalide")
      .refine((amount) => amount !== 0, "Le montant doit être différent de zéro"),
    periodicity: z.enum(PERIODICITIES),
    dueDay: z
      .number()
      .int("Jour entier attendu")
      .min(1, "Jour entre 1 et 31")
      .max(31, "Jour entre 1 et 31")
      .nullable(),
    dueMonth: z.number().int("Mois entier attendu").min(1, "Mois d'échéance invalide").max(12, "Mois d'échéance invalide").nullable(),
    categoryId: z.string().min(1).nullable(),
    startDate: isoDateSchema,
    endDate: isoDateSchema.nullable(),
    rule: ruleMatcherSchema.nullable().optional(),
  })
  .superRefine((payload, context) => {
    const error = dueMonthError(payload)
    if (error !== null) context.addIssue({ code: "custom", path: ["dueMonth"], message: error })
    if (payload.endDate !== null && payload.endDate < payload.startDate) {
      context.addIssue({ code: "custom", path: ["endDate"], message: "La date de fin précède la date de début" })
    }
  })

export type FixedItemPayload = z.infer<typeof fixedItemPayloadSchema>
