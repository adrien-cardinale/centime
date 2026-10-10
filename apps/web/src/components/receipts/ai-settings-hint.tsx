import { Link } from "@tanstack/react-router"
import { Sparkles } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

let hintShownThisSession = false

export function AiSettingsHint() {
  const { t } = useTranslation()
  const [visible] = useState(() => !hintShownThisSession)

  useEffect(() => {
    hintShownThisSession = true
  }, [])

  if (!visible) return null
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Sparkles className="size-3.5" aria-hidden />
      <Link to="/settings" className="underline-offset-4 hover:underline">
        {t("receipts.ai.settingsHint")}
      </Link>
    </p>
  )
}
