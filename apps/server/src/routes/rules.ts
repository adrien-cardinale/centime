import { ruleMatcherSchema, rulePayloadSchema } from "@centime/core"
import type { Db } from "@centime/db"
import { applyRules, applyRulesInputSchema, createRule, deleteRule, listRules, testRule, updateRule } from "@centime/services"
import { Hono } from "hono"
import { idParamSchema, validated } from "./validation"

export function createRuleRoutes(db: Db) {
  return new Hono()
    .get("/", async (c) => c.json(await listRules(db), 200))
    .post("/test", validated("json", ruleMatcherSchema), async (c) => c.json(await testRule(db, c.req.valid("json")), 200))
    .post("/apply", validated("json", applyRulesInputSchema), async (c) => c.json(await applyRules(db, c.req.valid("json")), 200))
    .post("/", validated("json", rulePayloadSchema), async (c) => c.json(await createRule(db, c.req.valid("json")), 201))
    .put("/:id", validated("param", idParamSchema), validated("json", rulePayloadSchema), async (c) => {
      const rule = await updateRule(db, { ...c.req.valid("json"), id: c.req.valid("param").id })
      return c.json(rule, 200)
    })
    .delete("/:id", validated("param", idParamSchema), async (c) => c.json(await deleteRule(db, c.req.valid("param")), 200))
}
