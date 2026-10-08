import { type CsvProfile, type CsvProfileInput, csvProfileSchema } from "@centime/core"
import type { CsvProfileRow, NewCsvProfileRow } from "./schema"

export function csvProfileToRow(profile: CsvProfileInput): Pick<NewCsvProfileRow, "name" | "config"> {
  const { name, ...config } = profile
  return { name, config: JSON.stringify(config) }
}

export function csvProfileFromRow(row: Pick<CsvProfileRow, "id" | "name" | "config">): CsvProfile | null {
  let config: unknown
  try {
    config = JSON.parse(row.config)
  } catch {
    return null
  }
  const parsed = csvProfileSchema.safeParse({ ...(typeof config === "object" ? config : {}), name: row.name })
  return parsed.success ? { ...parsed.data, id: row.id } : null
}

