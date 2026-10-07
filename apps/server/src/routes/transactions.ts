import type { Db } from "@centime/db"
import {
  bulkTransactionUpdateSchema,
  bulkUpdateTransactions,
  type Clock,
  exportTransactions,
  listTransactionPage,
  systemClock,
  type TransactionFilter,
  transactionChangesSchema,
  updateTransaction,
} from "@centime/services"
import { Hono } from "hono"
import { z } from "zod"
import { idParamSchema, validated } from "./validation"

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const booleanFlag = z.enum(["true", "false"]).optional()

const filterQuerySchema = z.object({
  accountId: z.string().min(1).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  search: z.string().trim().optional(),
  categoryId: z.string().min(1).optional(),
  themeId: z.string().min(1).optional(),
  fixedItemId: z.string().min(1).optional(),
  isTransfer: booleanFlag,
})

const listQuerySchema = filterQuerySchema.extend({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
})

type FilterQuery = z.infer<typeof filterQuerySchema>

function flagOf(value: "true" | "false" | undefined): boolean | undefined {
  return value === undefined ? undefined : value === "true"
}

function toFilter(query: FilterQuery): TransactionFilter {
  return {
    ...query,
    isTransfer: flagOf(query.isTransfer),
  }
}

export function createTransactionRoutes(db: Db, clock: Clock = systemClock) {
  return new Hono()
    .get("/", validated("query", listQuerySchema), async (c) => {
      const { page, pageSize, ...query } = c.req.valid("query")
      return c.json(await listTransactionPage(db, { ...toFilter(query), page, pageSize }), 200)
    })
    .get("/export", validated("query", filterQuerySchema), async (c) => {
      const file = await exportTransactions(db, toFilter(c.req.valid("query")), clock)
      return c.body(file.content, 200, {
        "Content-Type": file.contentType,
        "Content-Disposition": `attachment; filename="${file.fileName}"`,
      })
    })
    .patch("/", validated("json", bulkTransactionUpdateSchema), async (c) =>
      c.json(await bulkUpdateTransactions(db, c.req.valid("json")), 200),
    )
    .patch("/:id", validated("param", idParamSchema), validated("json", transactionChangesSchema), async (c) => {
      const updated = await updateTransaction(db, { ...c.req.valid("json"), id: c.req.valid("param").id })
      return c.json(updated, 200)
    })
}
