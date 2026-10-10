import { checkPermissions, Format, openAppSettings, requestPermissions, scan } from "@tauri-apps/plugin-barcode-scanner"
import { ScanLine } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
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
import i18n from "@/i18n"
import { parseDeviceLink } from "@/lib/crypto/device-link"
import { completeOnboarding } from "@/lib/crypto/onboarding"

type CameraAccess = "granted" | "refused" | "blocked"

async function requestCameraAccess(): Promise<CameraAccess> {
  const state = await checkPermissions()
  if (state === "granted") return "granted"
  if (state === "denied") return "blocked"
  return (await requestPermissions()) === "granted" ? "granted" : "refused"
}

function showScanError(error: unknown) {
  const detail = error instanceof Error ? error.message : typeof error === "string" ? error : ""
  toast.error(i18n.t("boot.scan.failed"), detail === "" ? undefined : { description: detail })
}

export function ScanLinkButton({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation()
  const [pending, setPending] = useState(false)
  const [settingsPromptOpen, setSettingsPromptOpen] = useState(false)

  const scanLink = async () => {
    const scanned = await scan({ formats: [Format.QRCode], cameraDirection: "back" })
    const link = await parseDeviceLink(scanned.content)
    await completeOnboarding(link.key, link.serverUrl)
    onDone()
  }

  const run = async () => {
    setPending(true)
    try {
      const access = await requestCameraAccess()
      if (access === "blocked") return setSettingsPromptOpen(true)
      if (access === "refused") return void toast.error(t("boot.scan.cameraDenied"))
      await scanLink()
    } catch (error) {
      showScanError(error)
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <Button onClick={() => void run()} disabled={pending}>
        <ScanLine />
        {pending ? t("boot.scan.scanning") : t("boot.scan.action")}
      </Button>
      <AlertDialog open={settingsPromptOpen} onOpenChange={setSettingsPromptOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("boot.scan.settingsTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("boot.scan.settingsDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void openAppSettings()}>{t("boot.scan.openSettings")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
