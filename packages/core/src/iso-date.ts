import { isValid, parseISO } from "date-fns"
import { z } from "zod"

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function isIsoDate(value: string): boolean {
  return ISO_DATE_PATTERN.test(value) && isValid(parseISO(value))
}

export const isoDateSchema = z.string().refine(isIsoDate, "Date invalide (AAAA-MM-JJ)")
