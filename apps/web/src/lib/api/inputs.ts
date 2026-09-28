export type TransactionChanges = {
  categoryId?: string | null
  isTransfer?: boolean
  fixedItemId?: string | null
}

export type ImportUpload = {
  file: File
  profileId?: string | undefined
  accountId?: string | undefined
}
