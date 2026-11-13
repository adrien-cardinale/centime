import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

export function CurrencyNote({ currency, otherAccounts }: { currency: string; otherAccounts: number }) {
  const { t } = useTranslation()
  if (otherAccounts === 0) return null
  return (
    <p className="text-xs text-muted-foreground">
      {t("dashboard.otherCurrencies", { count: otherAccounts, currency })}{" "}
      <Link to="/settings" className="underline underline-offset-4 hover:text-foreground">
        {t("dashboard.changeBaseCurrency")}
      </Link>
    </p>
  )
}
