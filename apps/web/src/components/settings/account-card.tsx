import { LogOut, Trash2, TriangleAlert } from "lucide-react"
import { type ReactNode, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { deleteAccountEverywhere, leaveDevice } from "@/lib/account/account-actions"

export function AccountCard({ syncConfigured }: { syncConfigured: boolean }) {
  const { t } = useTranslation()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.account.title")}</CardTitle>
        <CardDescription>{t("settings.account.description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <LeaveDeviceButton syncConfigured={syncConfigured} />
        {syncConfigured && <DeleteAccountButton />}
      </CardContent>
    </Card>
  )
}

function LeaveDeviceButton({ syncConfigured }: { syncConfigured: boolean }) {
  const { t } = useTranslation()
  return (
    <AccountActionDialog
      triggerVariant="outline"
      icon={<LogOut />}
      label={t("settings.account.leave")}
      title={t("settings.account.leaveTitle")}
      description={t("settings.account.leaveDescription")}
      confirmLabel={t("settings.account.leaveConfirm")}
      failureMessage={t("settings.account.leaveFailed")}
      action={leaveDevice}
    >
      {syncConfigured ? (
        <Alert>
          <TriangleAlert />
          <AlertTitle>{t("settings.account.leaveKeyTitle")}</AlertTitle>
          <AlertDescription>{t("settings.account.leaveKeyDescription")}</AlertDescription>
        </Alert>
      ) : (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>{t("settings.account.leaveNoServerTitle")}</AlertTitle>
          <AlertDescription>{t("settings.account.leaveNoServerDescription")}</AlertDescription>
        </Alert>
      )}
    </AccountActionDialog>
  )
}

function DeleteAccountButton() {
  const { t } = useTranslation()
  return (
    <AccountActionDialog
      triggerVariant="destructive"
      icon={<Trash2 />}
      label={t("settings.account.delete")}
      title={t("settings.account.deleteTitle")}
      description={t("settings.account.deleteDescription")}
      confirmLabel={t("settings.account.deleteConfirm")}
      failureMessage={t("settings.account.deleteFailed")}
      action={deleteAccountEverywhere}
    >
      <Alert variant="destructive">
        <TriangleAlert />
        <AlertTitle>{t("settings.account.deleteWarningTitle")}</AlertTitle>
        <AlertDescription>{t("settings.account.deleteWarningDescription")}</AlertDescription>
      </Alert>
    </AccountActionDialog>
  )
}

type AccountActionDialogProps = {
  triggerVariant: "outline" | "destructive"
  icon: ReactNode
  label: string
  title: string
  description: string
  confirmLabel: string
  failureMessage: string
  action: () => Promise<void>
  children: ReactNode
}

function AccountActionDialog({
  triggerVariant,
  icon,
  label,
  title,
  description,
  confirmLabel,
  failureMessage,
  action,
  children,
}: AccountActionDialogProps) {
  const { t } = useTranslation()
  const [pending, setPending] = useState(false)

  const confirm = async () => {
    setPending(true)
    try {
      await action()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : failureMessage)
      setPending(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant={triggerVariant} className="w-full sm:w-auto" disabled={pending}>
          {icon}
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => void confirm()}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
