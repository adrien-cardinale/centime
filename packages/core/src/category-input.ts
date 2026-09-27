import { z } from "zod"

export const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1, "Le nom est obligatoire").max(80, "Nom trop long"),
  color: z.string().trim().regex(HEX_COLOR_PATTERN, "Couleur hexadécimale attendue, par exemple #4a84c4").toLowerCase(),
  icon: z.string().trim().min(1).nullable().optional(),
  parentId: z.string().min(1).nullable().optional(),
})

export type CategoryInput = z.infer<typeof categoryInputSchema>
