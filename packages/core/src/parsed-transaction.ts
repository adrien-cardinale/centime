import type { IsoDate, TransactionStatus } from "./types"

export type ParsedTransaction = {
  accountIdentifier: string | null
  bookingDate: IsoDate
  valueDate: IsoDate | null
  rawLabel: string
  merchant: string | null
  amount: number
  currency: string
  status: TransactionStatus
  balanceAfter: number | null
  sourceRef: string | null
  providerCategory: string | null
}

export type ParseError = {
  line: number
  message: string
}

export type ParseResult = {
  transactions: ParsedTransaction[]
  errors: ParseError[]
}
