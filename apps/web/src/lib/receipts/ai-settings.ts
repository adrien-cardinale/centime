import { type DbExecutor, settings } from "@centime/db"
import { eq } from "@centime/db/orm"
import { type UseMutationResult, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"
import { getLocalDatabase } from "@/lib/local-db/current-database"

export type AiExtractionSettings = { enabled: boolean; apiKey: string; model: string }

export const DEFAULT_AI_MODEL = "claude-opus-5-5"

export const SUGGESTED_AI_MODELS = ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"] as const

export const DEFAULT_AI_EXTRACTION_SETTINGS: AiExtractionSettings = {
  enabled: false,
  apiKey: "",
  model: DEFAULT_AI_MODEL,
}

const AI_SETTINGS_KEY = "receipts.ai"

const aiExtractionQueryKey = ["settings", AI_SETTINGS_KEY] as const

const storedSettingsSchema = z.object({
  enabled: z.boolean().catch(false),
  apiKey: z.string().catch(""),
  model: z.string().catch(DEFAULT_AI_MODEL),
})

function parseStoredSettings(value: string | undefined): AiExtractionSettings {
  if (value === undefined) return DEFAULT_AI_EXTRACTION_SETTINGS
  try {
    const parsed = storedSettingsSchema.safeParse(JSON.parse(value))
    if (!parsed.success) return DEFAULT_AI_EXTRACTION_SETTINGS
    return { ...parsed.data, model: parsed.data.model.trim() || DEFAULT_AI_MODEL }
  } catch {
    return DEFAULT_AI_EXTRACTION_SETTINGS
  }
}

async function readAiExtractionSettings(db: DbExecutor): Promise<AiExtractionSettings> {
  const [row] = await db.select().from(settings).where(eq(settings.key, AI_SETTINGS_KEY))
  return parseStoredSettings(row?.value)
}

async function writeAiExtractionSettings(db: DbExecutor, value: AiExtractionSettings): Promise<void> {
  const text = JSON.stringify({
    enabled: value.enabled,
    apiKey: value.apiKey.trim(),
    model: value.model.trim() || DEFAULT_AI_MODEL,
  })
  await db
    .insert(settings)
    .values({ key: AI_SETTINGS_KEY, value: text })
    .onConflictDoUpdate({ target: settings.key, set: { value: text } })
}

export function isAiExtractionReady(value: AiExtractionSettings): boolean {
  return value.enabled && value.apiKey.trim() !== ""
}

export function useAiExtractionSettings(): { settings: AiExtractionSettings; isLoading: boolean } {
  const query = useQuery({
    queryKey: aiExtractionQueryKey,
    queryFn: () => getLocalDatabase().run(readAiExtractionSettings),
  })
  return { settings: query.data ?? DEFAULT_AI_EXTRACTION_SETTINGS, isLoading: query.isLoading }
}

export function useSaveAiExtractionSettings(): UseMutationResult<void, Error, AiExtractionSettings> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (value: AiExtractionSettings) => getLocalDatabase().run((db) => writeAiExtractionSettings(db, value)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: aiExtractionQueryKey }),
  })
}
