import type { Db } from "@centime/db"
import { Hono } from "hono"
import { requireAuth } from "./auth/session"
import type { Config } from "./config"
import { handleError } from "./errors"
import { createAccountRoutes } from "./routes/accounts"
import { createAuthRoutes } from "./routes/auth"
import { createBudgetRoutes } from "./routes/budgets"
import { createCategoryRoutes } from "./routes/categories"
import { createThemeRoutes } from "./routes/themes"
import { createCsvProfileRoutes } from "./routes/csv-profiles"
import { createDashboardRoutes } from "./routes/dashboard"
import { createFixedItemRoutes } from "./routes/fixed-items"
import { healthRoutes } from "./routes/health"
import { createImportRoutes } from "./routes/imports"
import { createRuleRoutes } from "./routes/rules"
import { createSyncRoutes } from "./routes/sync"
import { createTransactionRoutes } from "./routes/transactions"

export type AppDeps = { db: Db; config: Config }

export function createApi(deps: AppDeps) {
  return new Hono()
    .basePath("/api")
    .onError(handleError)
    .use(requireAuth(deps))
    .route("/health", healthRoutes)
    .route("/auth", createAuthRoutes(deps))
    .route("/accounts", createAccountRoutes(deps.db))
    .route("/csv-profiles", createCsvProfileRoutes(deps.db))
    .route("/imports", createImportRoutes(deps.db))
    .route("/transactions", createTransactionRoutes(deps.db))
    .route("/themes", createThemeRoutes(deps.db))
    .route("/categories", createCategoryRoutes(deps.db))
    .route("/rules", createRuleRoutes(deps.db))
    .route("/fixed-items", createFixedItemRoutes(deps.db))
    .route("/budgets", createBudgetRoutes(deps.db))
    .route("/dashboard", createDashboardRoutes(deps.db))
    .route("/sync", createSyncRoutes(deps.db))
}

export type AppType = ReturnType<typeof createApi>
