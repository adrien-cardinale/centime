import { getApi } from "./api-ref"
import type { Api } from "./types"

export { ApiError } from "./errors"
export {
  normalizeTransactionFilter,
  type TransactionFilters,
  type TransactionPageFilters,
  type TransferFilter,
  UNCATEGORIZED_FILTER,
  WITHOUT_FIXED_ITEM_FILTER,
} from "./filters"
export type { ImportUpload, ReceiptCandidateOptions, ReceiptFileUpload, TransactionChanges } from "./inputs"
export type * from "./types"

type Domain = keyof Api
type Method = (...args: unknown[]) => unknown

function methodOf(domain: Domain, name: PropertyKey): Method {
  const methods = getApi()[domain] as unknown as Record<PropertyKey, Method | undefined>
  const method = methods[name]
  if (!method) throw new Error(`Méthode API inconnue : ${domain}.${String(name)}`)
  return method
}

function domainFacade(domain: Domain): object {
  const delegates = new Map<PropertyKey, Method>()
  return new Proxy(
    {},
    {
      get(_target, name) {
        let delegate = delegates.get(name)
        if (!delegate) {
          delegate = (...args: unknown[]) => methodOf(domain, name)(...args)
          delegates.set(name, delegate)
        }
        return delegate
      },
    },
  )
}

const domains = new Map<Domain, object>()

export const api = new Proxy(
  {},
  {
    get(_target, domain) {
      const key = domain as Domain
      let facade = domains.get(key)
      if (!facade) {
        facade = domainFacade(key)
        domains.set(key, facade)
      }
      return facade
    },
  },
) as Api
