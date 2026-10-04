import { createAccount, listAccounts } from "./accounts"
import { createBudget, deleteBudget, getBudgetsOverview, listBudgets, updateBudget } from "./budgets"
import { createCategory, deleteCategory, listCategories, updateCategory } from "./categories"
import { createCsvProfile, deleteCsvProfile, listCsvProfiles, updateCsvProfile } from "./csv-profiles"
import { getDashboard } from "./dashboard"
import {
  createFixedItem,
  deleteFixedItem,
  getFixedItemsOverview,
  listFixedItems,
  listFixedItemTransactions,
  updateFixedItem,
} from "./fixed-items"
import { commitImport, deleteImport, listImports, previewImport } from "./imports"
import { applyRules, createRule, deleteRule, listRules, testRule, updateRule } from "./rules"
import { exportTransactions } from "./transaction-export"
import { bulkUpdateTransactions, updateTransaction } from "./transaction-updates"
import { listTransactionPage } from "./transactions"

export const apiSurface = {
  accounts: {
    list: listAccounts,
    create: createAccount,
  },
  csvProfiles: {
    list: listCsvProfiles,
    create: createCsvProfile,
    update: updateCsvProfile,
    remove: deleteCsvProfile,
  },
  imports: {
    list: listImports,
    preview: previewImport,
    commit: commitImport,
    remove: deleteImport,
  },
  transactions: {
    list: listTransactionPage,
    update: updateTransaction,
    bulkUpdate: bulkUpdateTransactions,
    export: exportTransactions,
  },
  categories: {
    list: listCategories,
    create: createCategory,
    update: updateCategory,
    remove: deleteCategory,
  },
  rules: {
    list: listRules,
    create: createRule,
    update: updateRule,
    remove: deleteRule,
    test: testRule,
    apply: applyRules,
  },
  fixedItems: {
    list: listFixedItems,
    create: createFixedItem,
    update: updateFixedItem,
    remove: deleteFixedItem,
    overview: getFixedItemsOverview,
    transactions: listFixedItemTransactions,
  },
  budgets: {
    list: listBudgets,
    create: createBudget,
    update: updateBudget,
    remove: deleteBudget,
    overview: getBudgetsOverview,
  },
  dashboard: {
    overview: getDashboard,
  },
} as const

export type ApiSurface = typeof apiSurface
