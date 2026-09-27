import { categories, type DbExecutor } from "@centime/db"
import { isNull } from "drizzle-orm"

export type CategoryNode = { id: string; name: string; color: string; parentId: string | null }

export function loadCategoryNodes(db: DbExecutor): Promise<CategoryNode[]> {
  return db
    .select({ id: categories.id, name: categories.name, color: categories.color, parentId: categories.parentId })
    .from(categories)
    .where(isNull(categories.deletedAt))
}
