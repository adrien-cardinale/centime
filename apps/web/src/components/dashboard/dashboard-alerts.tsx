import { Link } from "@tanstack/react-router"
import { CircleAlert } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { type DashboardKpis, UNCATEGORIZED_FILTER } from "@/lib/api"

const linkClassName = "underline-offset-4 hover:text-foreground hover:underline"

export function DashboardAlerts({ kpis }: { kpis: DashboardKpis }) {
  const { t } = useTranslation()
  const alerts: { key: string; content: ReactNode }[] = []
  if (kpis.uncategorizedCount > 0) {
    alerts.push({
      key: "uncategorized",
      content: (
        <Link to="/transactions" search={{ categoryId: UNCATEGORIZED_FILTER }} className={linkClassName}>
          {t("dashboard.uncategorized", { count: kpis.uncategorizedCount })}
        </Link>
      ),
    })
  }
  if (kpis.budgetsExceeded > 0) {
    alerts.push({
      key: "budgets",
      content: (
        <Link to="/budgets" className={linkClassName}>
          {t("dashboard.budgetsExceeded", { count: kpis.budgetsExceeded })}
        </Link>
      ),
    })
  }
  if (kpis.overdueOccurrences > 0) {
    alerts.push({
      key: "overdue",
      content: (
        <Link to="/budgets" className={linkClassName}>
          {t("dashboard.overdue", { count: kpis.overdueOccurrences })}
        </Link>
      ),
    })
  }
  if (kpis.pendingCount > 0) {
    alerts.push({ key: "pending", content: <span>{t("dashboard.pending", { count: kpis.pendingCount })}</span> })
  }
  if (alerts.length === 0) return null
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground" aria-label={t("dashboard.alertsLabel")}>
      {alerts.map((alert) => (
        <li key={alert.key} className="inline-flex items-center gap-1.5">
          <CircleAlert className="size-3.5" aria-hidden />
          {alert.content}
        </li>
      ))}
    </ul>
  )
}
