import { Plus } from "lucide-react"
import { useTranslation } from "react-i18next"
import { OnboardingSteps } from "@/components/startup/onboarding"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { getLocalDatabase } from "@/lib/local-db/current-database"

function reloadOnNewAccount() {
  void getLocalDatabase()
    .flush()
    .finally(() => window.location.reload())
}

export function AddAccountDialog() {
  const { t } = useTranslation()

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full sm:w-auto">
          <Plus />
          {t("settings.account.add")}
        </Button>
      </DialogTrigger>
      <DialogContent className="px-0">
        <DialogHeader className="px-6">
          <DialogTitle>{t("settings.account.addTitle")}</DialogTitle>
          <DialogDescription>{t("settings.account.addDescription")}</DialogDescription>
        </DialogHeader>
        <OnboardingSteps onDone={reloadOnNewAccount} />
      </DialogContent>
    </Dialog>
  )
}
