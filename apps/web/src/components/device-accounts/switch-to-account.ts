import { toast } from "sonner"
import i18n from "@/i18n"
import { switchAccount } from "@/lib/account/account-actions"

export async function switchToAccount(id: string): Promise<void> {
  try {
    await switchAccount(id)
  } catch (error) {
    toast.error(i18n.t("settings.account.switchFailed"), {
      description: error instanceof Error ? error.message : undefined,
    })
  }
}
