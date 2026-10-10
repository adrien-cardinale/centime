import { Link, type LinkProps } from "@tanstack/react-router"
import { ChevronRight, CircleAlert } from "lucide-react"
import { useTranslation } from "react-i18next"
import { type DashboardKpis, UNCATEGORIZED_FILTER } from "@/lib/api"

type Alert = { key: string; label: string; link?: Pick<LinkProps, "to" | "search"> }

const rowClassName = "flex min-h-11 items-center gap-2 rounded-md px-2 text-sm"

function alertsOf(kpis: DashboardKpis, t: (key: string, options: { count: number }) => string): Alert[] {
  const alerts: Alert[] = []
  if (kpis.uncategorizedCount > 0) {
    alerts.push({
      key: "uncategorized",
      label: t("dashboard.uncategorized", { count: kpis.uncategorizedCount }),
      link: { to: "/transactions", search: { categoryId: UNCATEGORIZED_FILTER } },
    })
  }
  if (kpis.budgetsExceeded > 0) {
    alerts.push({ key: "budgets", label: t("dashboard.budgetsExceeded", { count: kpis.budgetsExceeded }), link: { to: "/budgets" } })
  }
  if (kpis.overdueOccurrences > 0) {
    alerts.push({ key: "overdue", label: t("dashboard.overdue", { count: kpis.overdueOccurrences }), link: { to: "/budgets" } })
  }
  if (kpis.pendingCount > 0) {
    alerts.push({ key: "pending", label: t("dashboard.pending", { count: kpis.pendingCount }) })
  }
  return alerts
}

export function DashboardAlerts({ kpis }: { kpis: DashboardKpis }) {
  const { t } = useTranslation()
  const alerts = alertsOf(kpis, t)
  if (alerts.length === 0) return null
  return (
    <ul className="-mx-2 grid gap-x-4 sm:flex sm:flex-wrap" aria-label={t("dashboard.alertsLabel")}>
      {alerts.map((alert) => (
        <li key={alert.key}>
          {alert.link ? (
            <Link {...alert.link} className={`${rowClassName} text-foreground hover:bg-muted/50`}>
              <CircleAlert className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="flex-1 underline underline-offset-4">{alert.label}</span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          ) : (
            <span className={`${rowClassName} text-muted-foreground`}>
              <CircleAlert className="size-4 shrink-0" aria-hidden />
              {alert.label}
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}
