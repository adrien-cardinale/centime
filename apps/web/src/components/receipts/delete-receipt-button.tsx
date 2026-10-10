import { type ReactNode, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { useRemoveReceipt } from "@/hooks/use-receipt-updates"
import type { Receipt } from "@/lib/api"

type DeleteReceiptButtonProps = {
  receipt: Receipt
  onDeleted: () => void
  children: ReactNode
}

export function DeleteReceiptButton({ receipt, onDeleted, children }: DeleteReceiptButtonProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const remove = useRemoveReceipt(onDeleted)

  return (
    <>
      <Button type="button" variant="outline" className="text-destructive" onClick={() => setOpen(true)}>
        {children}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("receipts.delete.title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("receipts.delete.description")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => remove.mutate(receipt.id)} disabled={remove.isPending}>
              {t("receipts.delete.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
