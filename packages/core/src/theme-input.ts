import { z } from "zod"
import { HEX_COLOR_PATTERN } from "./category-input"

export const themeInputSchema = z.object({
  name: z.string().trim().min(1, "Le nom est obligatoire").max(80, "Nom trop long"),
  color: z.string().trim().regex(HEX_COLOR_PATTERN, "Couleur hexadécimale attendue, par exemple #4a84c4").toLowerCase(),
  icon: z.string().trim().min(1).nullable().optional(),
})

export type ThemeInput = z.infer<typeof themeInputSchema>
