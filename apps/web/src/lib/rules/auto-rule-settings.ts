import type { DbExecutor } from "@centime/db"
import { type UseMutationResult, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"
import { getLocalDatabase } from "@/lib/local-db/current-database"
import { readPreference, writePreference } from "@/lib/preferences"

const DEFAULT_AUTO_RULE_ENABLED = true

const autoRuleQueryKey = ["preferences", "rules.auto"] as const

const storedSettingSchema = z.object({ enabled: z.boolean().catch(DEFAULT_AUTO_RULE_ENABLED) })

function parseStoredSetting(value: string | undefined): boolean {
  if (value === undefined) return DEFAULT_AUTO_RULE_ENABLED
  try {
    const parsed = storedSettingSchema.safeParse(JSON.parse(value))
    return parsed.success ? parsed.data.enabled : DEFAULT_AUTO_RULE_ENABLED
  } catch {
    return DEFAULT_AUTO_RULE_ENABLED
  }
}

async function readAutoRuleSetting(db: DbExecutor): Promise<boolean> {
  return parseStoredSetting(await readPreference(db, "rules.auto"))
}

async function writeAutoRuleSetting(db: DbExecutor, enabled: boolean): Promise<void> {
  await writePreference(db, "rules.auto", JSON.stringify({ enabled }))
}

export function useAutoRuleSetting(): { enabled: boolean; isLoading: boolean } {
  const query = useQuery({
    queryKey: autoRuleQueryKey,
    queryFn: () => getLocalDatabase().run(readAutoRuleSetting),
  })
  return { enabled: query.data ?? DEFAULT_AUTO_RULE_ENABLED, isLoading: query.isLoading }
}

export function useSaveAutoRuleSetting(): UseMutationResult<void, Error, boolean> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (enabled: boolean) => getLocalDatabase().run((db) => writeAutoRuleSetting(db, enabled)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: autoRuleQueryKey }),
  })
}
