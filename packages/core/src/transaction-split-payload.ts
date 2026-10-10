import { z } from "zod"

export const MIN_SPLITS = 2
export const MAX_SPLITS = 20
export const MAX_SPLIT_NOTE_LENGTH = 200

export const transactionSplitLineSchema = z.object({
  categoryId: z.uuid("Catégorie invalide").nullable(),
  amount: z
    .number({ error: "Montant invalide" })
    .refine(Number.isFinite, "Montant invalide")
    .refine((amount) => amount !== 0, "Le montant doit être différent de zéro"),
  note: z
    .string()
    .trim()
    .max(MAX_SPLIT_NOTE_LENGTH, "Note trop longue")
    .nullish()
    .transform((note) => note || null),
})

export const transactionSplitSchema = z.object({
  transactionId: z.uuid("Transaction invalide"),
  splits: z
    .array(transactionSplitLineSchema)
    .min(MIN_SPLITS, `Répartissez sur au moins ${MIN_SPLITS} lignes`)
    .max(MAX_SPLITS, `${MAX_SPLITS} lignes au maximum`),
})

export const transactionUnsplitSchema = z.object({ transactionId: z.uuid("Transaction invalide") })

export type TransactionSplitLine = z.output<typeof transactionSplitLineSchema>
export type TransactionSplitInput = z.input<typeof transactionSplitSchema>
export type TransactionSplit = z.output<typeof transactionSplitSchema>
export type TransactionUnsplit = z.output<typeof transactionUnsplitSchema>

function toCents(amount: number): number {
  return Math.round(amount * 100)
}

export function splitRemainder(total: number, splits: readonly { amount: number }[]): number {
  const allocated = splits.reduce((sum, split) => sum + toCents(split.amount), 0)
  return (toCents(total) - allocated) / 100
}

export function splitsBalance(total: number, splits: readonly { amount: number }[]): boolean {
  return splitRemainder(total, splits) === 0
}
