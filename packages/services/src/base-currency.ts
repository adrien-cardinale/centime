import {
  baseCurrencyOptions,
  countOtherCurrencyAccounts,
  normalizeCurrencyCode,
  resolveBaseCurrency,
} from "@centime/core"
import { accounts, type DbExecutor } from "@centime/db"
import { isNull } from "drizzle-orm"
import { ServiceError } from "./errors"
import { readPreference, writePreference } from "./preferences"

export type BaseCurrencyContext = { currency: string; otherCurrencyAccounts: number; options: string[] }

async function loadAccountCurrencies(db: DbExecutor): Promise<string[]> {
  const rows = await db.select({ currency: accounts.currency }).from(accounts).where(isNull(accounts.deletedAt))
  return rows.map((row) => row.currency)
}

export async function loadBaseCurrencyContext(db: DbExecutor): Promise<BaseCurrencyContext> {
  const [stored, accountCurrencies] = await Promise.all([
    readPreference(db, "currency.base"),
    loadAccountCurrencies(db),
  ])
  const currency = resolveBaseCurrency(stored, accountCurrencies)
  return {
    currency,
    otherCurrencyAccounts: countOtherCurrencyAccounts(accountCurrencies, currency),
    options: baseCurrencyOptions(accountCurrencies, currency),
  }
}

export async function loadBaseCurrency(db: DbExecutor): Promise<string> {
  return (await loadBaseCurrencyContext(db)).currency
}

export async function saveBaseCurrency(db: DbExecutor, currency: string): Promise<void> {
  const code = normalizeCurrencyCode(currency)
  if (code === null) throw new ServiceError("Devise invalide")
  await writePreference(db, "currency.base", code)
}
