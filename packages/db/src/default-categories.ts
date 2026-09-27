import type { DbExecutor } from "./client"
import { categories, type NewCategoryRow } from "./schema"

type DefaultCategory = Required<Pick<NewCategoryRow, "id" | "name" | "color">>

export const DEFAULT_CATEGORY_IDS = {
  food: "7c1e4a2b-3d5f-4a6b-8c9d-0e1f2a3b4c01",
  restaurants: "7c1e4a2b-3d5f-4a6b-8c9d-0e1f2a3b4c02",
  transport: "7c1e4a2b-3d5f-4a6b-8c9d-0e1f2a3b4c03",
  fuel: "7c1e4a2b-3d5f-4a6b-8c9d-0e1f2a3b4c04",
  housing: "7c1e4a2b-3d5f-4a6b-8c9d-0e1f2a3b4c05",
  insurance: "7c1e4a2b-3d5f-4a6b-8c9d-0e1f2a3b4c06",
  health: "7c1e4a2b-3d5f-4a6b-8c9d-0e1f2a3b4c07",
  leisure: "7c1e4a2b-3d5f-4a6b-8c9d-0e1f2a3b4c08",
  subscriptions: "7c1e4a2b-3d5f-4a6b-8c9d-0e1f2a3b4c09",
  shopping: "7c1e4a2b-3d5f-4a6b-8c9d-0e1f2a3b4c10",
  travel: "7c1e4a2b-3d5f-4a6b-8c9d-0e1f2a3b4c11",
  education: "7c1e4a2b-3d5f-4a6b-8c9d-0e1f2a3b4c12",
  taxes: "7c1e4a2b-3d5f-4a6b-8c9d-0e1f2a3b4c13",
  bankFees: "7c1e4a2b-3d5f-4a6b-8c9d-0e1f2a3b4c14",
  gifts: "7c1e4a2b-3d5f-4a6b-8c9d-0e1f2a3b4c15",
  salary: "7c1e4a2b-3d5f-4a6b-8c9d-0e1f2a3b4c16",
  otherIncome: "7c1e4a2b-3d5f-4a6b-8c9d-0e1f2a3b4c17",
  savings: "7c1e4a2b-3d5f-4a6b-8c9d-0e1f2a3b4c18",
  other: "7c1e4a2b-3d5f-4a6b-8c9d-0e1f2a3b4c19",
} as const

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { id: DEFAULT_CATEGORY_IDS.food, name: "Alimentation", color: "#5b9a4f" },
  { id: DEFAULT_CATEGORY_IDS.restaurants, name: "Restaurants et cafés", color: "#d08a3e" },
  { id: DEFAULT_CATEGORY_IDS.transport, name: "Transport", color: "#4a84c4" },
  { id: DEFAULT_CATEGORY_IDS.fuel, name: "Carburant", color: "#9a7550" },
  { id: DEFAULT_CATEGORY_IDS.housing, name: "Logement", color: "#8067b7" },
  { id: DEFAULT_CATEGORY_IDS.insurance, name: "Assurances", color: "#4f8196" },
  { id: DEFAULT_CATEGORY_IDS.health, name: "Santé", color: "#cc6666" },
  { id: DEFAULT_CATEGORY_IDS.leisure, name: "Loisirs", color: "#c46a9e" },
  { id: DEFAULT_CATEGORY_IDS.subscriptions, name: "Abonnements", color: "#6f78cc" },
  { id: DEFAULT_CATEGORY_IDS.shopping, name: "Shopping", color: "#c9a23a" },
  { id: DEFAULT_CATEGORY_IDS.travel, name: "Voyages", color: "#3a9e9b" },
  { id: DEFAULT_CATEGORY_IDS.education, name: "Éducation", color: "#7d9a3a" },
  { id: DEFAULT_CATEGORY_IDS.taxes, name: "Impôts et taxes", color: "#a0605a" },
  { id: DEFAULT_CATEGORY_IDS.bankFees, name: "Frais bancaires", color: "#7c8490" },
  { id: DEFAULT_CATEGORY_IDS.gifts, name: "Cadeaux et dons", color: "#b0679e" },
  { id: DEFAULT_CATEGORY_IDS.salary, name: "Salaire", color: "#3f9a6e" },
  { id: DEFAULT_CATEGORY_IDS.otherIncome, name: "Autres revenus", color: "#5aa8b5" },
  { id: DEFAULT_CATEGORY_IDS.savings, name: "Épargne", color: "#3f6fae" },
  { id: DEFAULT_CATEGORY_IDS.other, name: "Autres", color: "#9a9aa3" },
]

export async function seedDefaultCategories(db: DbExecutor): Promise<void> {
  await db.insert(categories).values(DEFAULT_CATEGORIES).onConflictDoNothing({ target: categories.id })
}
