import type { DbExecutor } from "./client"
import { DEFAULT_CATEGORY_IDS } from "./default-categories"
import { type NewRuleRow, rules } from "./schema"

const TRANSFER_PRIORITY = 100
const PROVIDER_CATEGORY_PRIORITY = 10
const GENERIC_PRIORITY = 5

type DefaultRule = Required<Pick<NewRuleRow, "id" | "pattern" | "matchKind" | "field" | "priority">> &
  Pick<NewRuleRow, "categoryId" | "markAsTransfer">

function transferRule(id: string, pattern: string): DefaultRule {
  return { id, pattern, matchKind: "contains", field: "raw_label", markAsTransfer: true, priority: TRANSFER_PRIORITY }
}

function providerCategoryRule(id: string, pattern: string, categoryId: string): DefaultRule {
  return { id, pattern, matchKind: "contains", field: "provider_category", categoryId, priority: PROVIDER_CATEGORY_PRIORITY }
}

function labelRule(id: string, pattern: string, matchKind: DefaultRule["matchKind"], categoryId: string): DefaultRule {
  return { id, pattern, matchKind, field: "raw_label", categoryId, priority: GENERIC_PRIORITY }
}

export const DEFAULT_RULES: DefaultRule[] = [
  transferRule("9d2f6b1a-4c3e-4f5a-9b8c-7d6e5f4a3b01", "transfert de compte à compte"),
  transferRule("9d2f6b1a-4c3e-4f5a-9b8c-7d6e5f4a3b02", "Cpt. épargne"),
  transferRule("9d2f6b1a-4c3e-4f5a-9b8c-7d6e5f4a3b03", "Cpte épargne"),
  transferRule("9d2f6b1a-4c3e-4f5a-9b8c-7d6e5f4a3b04", "Swisscard AECS"),
  providerCategoryRule("9d2f6b1a-4c3e-4f5a-9b8c-7d6e5f4a3b11", "Comestibles", DEFAULT_CATEGORY_IDS.food),
  providerCategoryRule("9d2f6b1a-4c3e-4f5a-9b8c-7d6e5f4a3b12", "Gastronomie", DEFAULT_CATEGORY_IDS.restaurants),
  providerCategoryRule("9d2f6b1a-4c3e-4f5a-9b8c-7d6e5f4a3b13", "Voiture", DEFAULT_CATEGORY_IDS.fuel),
  providerCategoryRule("9d2f6b1a-4c3e-4f5a-9b8c-7d6e5f4a3b14", "Divertissement", DEFAULT_CATEGORY_IDS.leisure),
  providerCategoryRule("9d2f6b1a-4c3e-4f5a-9b8c-7d6e5f4a3b15", "Achats", DEFAULT_CATEGORY_IDS.shopping),
  providerCategoryRule("9d2f6b1a-4c3e-4f5a-9b8c-7d6e5f4a3b16", "Voyage", DEFAULT_CATEGORY_IDS.travel),
  providerCategoryRule("9d2f6b1a-4c3e-4f5a-9b8c-7d6e5f4a3b17", "Santé", DEFAULT_CATEGORY_IDS.health),
  providerCategoryRule("9d2f6b1a-4c3e-4f5a-9b8c-7d6e5f4a3b18", "Général", DEFAULT_CATEGORY_IDS.other),
  labelRule("9d2f6b1a-4c3e-4f5a-9b8c-7d6e5f4a3b21", "\\b(Coop|Migros|Denner|Aldi|Lidl)\\b", "regex", DEFAULT_CATEGORY_IDS.food),
  labelRule("9d2f6b1a-4c3e-4f5a-9b8c-7d6e5f4a3b22", "Station[- ]service|\\b(Tamoil|Socar|Agrola)\\b", "regex", DEFAULT_CATEGORY_IDS.fuel),
  labelRule("9d2f6b1a-4c3e-4f5a-9b8c-7d6e5f4a3b23", "\\b(CFF|SBB|TL)\\b", "regex", DEFAULT_CATEGORY_IDS.transport),
  labelRule("9d2f6b1a-4c3e-4f5a-9b8c-7d6e5f4a3b24", "Salaire", "contains", DEFAULT_CATEGORY_IDS.salary),
  labelRule("9d2f6b1a-4c3e-4f5a-9b8c-7d6e5f4a3b25", "Assura|\\b(Generali|CSS|Helsana)\\b", "regex", DEFAULT_CATEGORY_IDS.insurance),
]

export async function seedDefaultRules(db: DbExecutor): Promise<void> {
  await db.insert(rules).values(DEFAULT_RULES).onConflictDoNothing({ target: rules.id })
}
