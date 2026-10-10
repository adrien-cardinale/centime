import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useCreateReceipt, useUpdateReceipt } from "@/hooks/use-receipt-updates"
import type { Account, Receipt, TransactionItem } from "@/lib/api"
import { todayIso } from "@/lib/budgets"
import type { PreparedReceiptImage } from "@/lib/receipts/prepare-image"
import { accountsQuery, receiptsQuery } from "@/lib/queries"
import { ApplyLinesOffer } from "./apply-lines-offer"
import { ReceiptDetailsForm } from "./receipt-details-form"
import { detailsFormValues, type ReceiptDetails } from "./receipt-form"
import { canSplitFromLines } from "./receipt-lines"
import { ReceiptLinkPanel } from "./receipt-link-panel"
import { ReceiptPhotoStep } from "./receipt-photo-step"

type Step = "photo" | "details" | "link" | "split"

type ReceiptDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction?: TransactionItem | null
}

export function ReceiptDialog({ open, onOpenChange, transaction = null }: ReceiptDialogProps) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{transaction ? t("receipts.dialog.attachTitle") : t("receipts.dialog.title")}</DialogTitle>
          <DialogDescription>{t("receipts.dialog.description")}</DialogDescription>
        </DialogHeader>
        {open && <ReceiptFlow transaction={transaction} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function defaultAccountId(accounts: Account[], receipts: Receipt[]): string {
  if (accounts.length === 1) return accounts[0]?.id ?? ""
  return receipts[0]?.accountId ?? ""
}

function transactionDefaults(transaction: TransactionItem) {
  return {
    accountId: transaction.accountId,
    total: transaction.amount < 0 ? Math.abs(transaction.amount) : null,
    receiptDate: transaction.bookingDate,
    merchant: transaction.merchant,
  }
}

type ReceiptFlowProps = {
  transaction: TransactionItem | null
  onClose: () => void
}

function ReceiptFlow({ transaction, onClose }: ReceiptFlowProps) {
  const { t } = useTranslation()
  const [step, setStep] = useState<Step>("photo")
  const [image, setImage] = useState<PreparedReceiptImage | null>(null)
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const { data: accounts = [] } = useQuery(accountsQuery)
  const { data: receipts = [] } = useQuery(receiptsQuery())

  const finishWith = (saved: Receipt) => {
    setReceipt(saved)
    if (canSplitFromLines(saved)) setStep("split")
    else onClose()
  }
  const create = useCreateReceipt((created) => {
    if (transaction) finishWith(created)
    else {
      setReceipt(created)
      setStep("link")
    }
  })
  const ignore = useUpdateReceipt(() => {
    toast.success(t("receipts.toast.ignored"))
    onClose()
  })

  const save = (details: ReceiptDetails) => {
    if (!image) return
    create.mutate({ ...details, file: image, transactionId: transaction?.id ?? null })
  }

  if (step === "photo" || !image) {
    return <ReceiptPhotoStep image={image} onImageChange={setImage} onContinue={() => setStep("details")} />
  }
  if (step === "details" || !receipt) {
    const source = transaction
      ? transactionDefaults(transaction)
      : { accountId: defaultAccountId(accounts, receipts), receiptDate: todayIso() }
    return (
      <ReceiptDetailsForm
        defaultValues={detailsFormValues(source)}
        showAccount={!transaction}
        submitLabel={t("receipts.actions.save")}
        pendingLabel={t("receipts.actions.saving")}
        pending={create.isPending}
        onSubmit={save}
        onBack={() => setStep("photo")}
        ocrImage={image}
        autoOcr
        aiSettingsHint
      />
    )
  }
  if (step === "link") {
    return (
      <ReceiptLinkPanel
        receipt={receipt}
        onLinked={finishWith}
        actions={
          <>
            <Button
              type="button"
              variant="ghost"
              disabled={ignore.isPending}
              onClick={() => ignore.mutate({ id: receipt.id, patch: { status: "ignored" } })}
            >
              {t("receipts.actions.ignore")}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("receipts.actions.later")}
            </Button>
          </>
        }
      />
    )
  }
  return <ApplyLinesOffer receipt={receipt} onDone={onClose} />
}
