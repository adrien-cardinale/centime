import { z } from "zod"
import { isoDateSchema } from "./fixed-item-payload"
import { TRANSACTION_STATUSES } from "./types"

export const manualTransactionSchema = z.object({
  accountId: z.string({ error: "Choisissez un compte" }).min(1, "Choisissez un compte"),
  bookingDate: isoDateSchema,
  rawLabel: z.string().trim().min(1, "Le libellé est obligatoire").max(400, "Libellé trop long"),
  merchant: z
    .string()
    .trim()
    .max(200, "Commerçant trop long")
    .nullable()
    .default(null)
    .transform((merchant) => merchant || null),
  amount: z
    .number({ error: "Montant invalide" })
    .refine(Number.isFinite, "Montant invalide")
    .refine((amount) => amount !== 0, "Le montant doit être différent de zéro"),
  status: z.enum(TRANSACTION_STATUSES).default("booked"),
  categoryId: z.string().min(1).nullable().default(null),
  fixedItemId: z.string().min(1).nullable().default(null),
  isTransfer: z.boolean().default(false),
})

export type ManualTransactionInput = z.input<typeof manualTransactionSchema>
export type ManualTransaction = z.output<typeof manualTransactionSchema>
