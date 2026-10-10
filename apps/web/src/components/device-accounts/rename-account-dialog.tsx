import { useQueryClient } from "@tanstack/react-query"
import { Pencil } from "lucide-react"
import { type FormEvent, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { DeviceAccount } from "@/lib/account/account-index"
import { renameAccount } from "@/lib/account/accounts"
import { deviceAccountsQuery } from "@/lib/account/accounts-query"

const LABEL_MAX_LENGTH = 60

export function RenameAccountDialog({ account }: { account: DeviceAccount }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState(account.label)
  const [pending, setPending] = useState(false)
  const trimmed = label.trim()

  const changeOpen = (next: boolean) => {
    if (next) setLabel(account.label)
    setOpen(next)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setPending(true)
    try {
      await renameAccount(account.id, trimmed)
      await queryClient.invalidateQueries({ queryKey: deviceAccountsQuery.queryKey })
      setOpen(false)
    } catch (error) {
      toast.error(t("settings.account.renameFailed"), {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={t("settings.account.rename")}>
          <Pencil />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("settings.account.renameTitle")}</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(event) => void submit(event)}>
          <div className="space-y-2">
            <Label htmlFor="account-label">{t("settings.account.labelField")}</Label>
            <Input
              id="account-label"
              value={label}
              maxLength={LABEL_MAX_LENGTH}
              onChange={(event) => setLabel(event.target.value)}
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={trimmed === "" || pending}>
              {t("settings.account.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
