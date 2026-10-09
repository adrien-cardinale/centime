import { checkPermissions, Format, openAppSettings, requestPermissions, scan } from "@tauri-apps/plugin-barcode-scanner"
import { ScanLine } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { parseDeviceLink } from "@/lib/crypto/device-link"
import { completeOnboarding } from "@/lib/crypto/onboarding"

/** Demande l'accès caméra, puis ouvre les réglages système si l'utilisateur l'a refusé définitivement. */
async function ensureCameraAccess(): Promise<boolean> {
  const state = await checkPermissions()
  if (state === "granted") return true
  if (state === "denied") {
    await openAppSettings()
    return false
  }
  return (await requestPermissions()) === "granted"
}

export function ScanLinkButton({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation()
  const [pending, setPending] = useState(false)

  const run = async () => {
    setPending(true)
    try {
      if (!(await ensureCameraAccess())) return void toast.error(t("boot.scan.cameraDenied"))
      const scanned = await scan({ formats: [Format.QRCode], cameraDirection: "back" })
      const link = await parseDeviceLink(scanned.content)
      await completeOnboarding(link.key, link.serverUrl)
      onDone()
    } catch (error) {
      toast.error(error instanceof Error && error.message !== "" ? error.message : t("boot.scan.failed"))
    } finally {
      setPending(false)
    }
  }

  return (
    <Button onClick={() => void run()} disabled={pending}>
      <ScanLine />
      {pending ? t("boot.scan.scanning") : t("boot.scan.action")}
    </Button>
  )
}
