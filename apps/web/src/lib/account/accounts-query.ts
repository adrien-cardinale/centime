import { queryOptions } from "@tanstack/react-query"
import { readAccountIndex } from "./accounts"

export const deviceAccountsQuery = queryOptions({
  queryKey: ["device-accounts"],
  queryFn: readAccountIndex,
})
