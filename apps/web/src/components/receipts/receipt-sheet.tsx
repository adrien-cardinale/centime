import { useQuery } from "@tanstack/react-query"
import { Ban, Link2, Pencil, Split, Trash2, Undo2, Unlink } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { useUnlinkReceipt, useUpdateReceipt } from "@/hooks/use-receipt-updates"
import type { Receipt } from "@/lib/api"
import { formatDate, formatDecimal } from "@/lib/format"
import { receiptQuery } from "@/lib/queries"
import { ApplyLinesOffer } from "./apply-lines-offer"
import { DeleteReceiptButton } from "./delete-receipt-button"
import { ReceiptDetailsForm } from "./receipt-details-form"
import { detailsFormValues, type ReceiptDetails } from "./receipt-form"
import { canSplitFromLines } from "./receipt-lines"
import { ReceiptImageView } from "./receipt-image-view"
import { ReceiptLinkPanel } from "./receipt-link-panel"
import { ReceiptSummary } from "./receipt-summary"
import { ReceiptStatusBadge } from "./receipt-status-badge"

type Mode = "view" | "edit" | "link" | "split"

type ReceiptSheetProps = {
  receiptId: string | null
  onOpenChange: (open: boolean) => void
}

export function ReceiptSheet({ receiptId, onOpenChange }: ReceiptSheetProps) {
  return (
    <Sheet open={receiptId !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {receiptId !== null && (
          <ReceiptSheetContent key={receiptId} receiptId={receiptId} onClose={() => onOpenChange(false)} />
        )}
      </SheetContent>
    </Sheet>
  )
}

function ReceiptSheetContent({ receiptId, onClose }: { receiptId: string; onClose: () => void }) {
  const { t } = useTranslation()
  const { data: receipt, error } = useQuery(receiptQuery(receiptId))
  if (error) {
    return (
      <SheetHeader>
        <SheetTitle>{t("receipts.untitled")}</SheetTitle>
        <SheetDescription className="text-destructive">{error.message}</SheetDescription>
      </SheetHeader>
    )
  }
  if (!receipt) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }
  return <ReceiptPanel receipt={receipt} onClose={onClose} />
}

function headerDescription(receipt: Receipt): string {
  const date = formatDate(receipt.receiptDate ?? receipt.capturedAt.slice(0, 10))
  return receipt.total === null ? date : `${date} · ${formatDecimal(receipt.total)}`
}

function ReceiptPanel({ receipt, onClose }: { receipt: Receipt; onClose: () => void }) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<Mode>("view")
  const update = useUpdateReceipt(() => setMode("view"))
  const backToView = () => setMode("view")

  const saveDetails = (details: ReceiptDetails) =>
    update.mutate(
      {
        id: receipt.id,
        patch: {
          merchant: details.merchant,
          total: details.total,
          receiptDate: details.receiptDate,
          note: details.note,
          lines: details.lines,
        },
      },
      { onSuccess: () => toast.success(t("receipts.toast.updated")) },
    )

  return (
    <>
      <SheetHeader>
        <SheetTitle>{receipt.merchant ?? t("receipts.untitled")}</SheetTitle>
        <SheetDescription className="flex flex-wrap items-center gap-2 tabular-nums">
          <span>{headerDescription(receipt)}</span>
          <ReceiptStatusBadge status={receipt.status} />
        </SheetDescription>
      </SheetHeader>
      <div className="space-y-6 px-4 pb-6">
        <ReceiptImageView receipt={receipt} />
        {mode === "view" && (
          <>
            <ReceiptSummary receipt={receipt} />
            <ReceiptActions receipt={receipt} onModeChange={setMode} onDeleted={onClose} />
          </>
        )}
        {mode === "edit" && (
          <ReceiptDetailsForm
            defaultValues={detailsFormValues(receipt)}
            showAccount={false}
            submitLabel={t("receipts.actions.save")}
            pendingLabel={t("receipts.actions.saving")}
            pending={update.isPending}
            onSubmit={saveDetails}
            onBack={backToView}
            backLabel={t("common.cancel")}
          />
        )}
        {mode === "link" && (
          <ReceiptLinkPanel
            receipt={receipt}
            onLinked={(linked) => setMode(canSplitFromLines(linked) ? "split" : "view")}
            actions={
              <Button type="button" variant="outline" onClick={backToView}>
                {t("common.cancel")}
              </Button>
            }
          />
        )}
        {mode === "split" && <ApplyLinesOffer receipt={receipt} onDone={backToView} />}
      </div>
    </>
  )
}

type ReceiptActionsProps = {
  receipt: Receipt
  onModeChange: (mode: Mode) => void
  onDeleted: () => void
}

function ReceiptActions({ receipt, onModeChange, onDeleted }: ReceiptActionsProps) {
  const { t } = useTranslation()
  const unlink = useUnlinkReceipt()
  const changeStatus = useUpdateReceipt()
  const isLinked = receipt.status === "linked"
  const isIgnored = receipt.status === "ignored"
  const busy = unlink.isPending || changeStatus.isPending

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <Button type="button" variant="outline" onClick={() => onModeChange("edit")}>
        <Pencil />
        {t("receipts.actions.edit")}
      </Button>
      {isLinked ? (
        <Button type="button" variant="outline" disabled={busy} onClick={() => unlink.mutate(receipt.id)}>
          <Unlink />
          {t("receipts.actions.unlink")}
        </Button>
      ) : (
        <Button type="button" variant="outline" onClick={() => onModeChange("link")}>
          <Link2 />
          {t("receipts.actions.link")}
        </Button>
      )}
      {canSplitFromLines(receipt) && (
        <Button type="button" variant="outline" onClick={() => onModeChange("split")}>
          <Split />
          {t("receipts.actions.split")}
        </Button>
      )}
      {isIgnored ? (
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => changeStatus.mutate({ id: receipt.id, patch: { status: "pending" } })}
        >
          <Undo2 />
          {t("receipts.actions.restore")}
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() =>
            changeStatus.mutate(
              { id: receipt.id, patch: { status: "ignored" } },
              { onSuccess: () => toast.success(t("receipts.toast.ignored")) },
            )
          }
        >
          <Ban />
          {t("receipts.actions.ignore")}
        </Button>
      )}
      <DeleteReceiptButton receipt={receipt} onDeleted={onDeleted}>
        <Trash2 />
        {t("receipts.actions.delete")}
      </DeleteReceiptButton>
    </div>
  )
}
