import { useTranslation } from "react-i18next"
import type { DashboardKpis } from "@/lib/api"
import { money } from "@/lib/dashboard"
import { MonthDelta, NegativeMarker, StatTile } from "./stat-tile"

export function KpiTiles({ kpis }: { kpis: DashboardKpis }) {
  const { t } = useTranslation()
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatTile
        label={t("dashboardPage.balance.title")}
        value={kpis.bankBalance === null ? "—" : money(kpis.bankBalance)}
        footer={kpis.bankBalance === null ? t("dashboardPage.kpi.noBalance") : t("dashboardPage.kpi.lastKnownBalance")}
      />
      <StatTile label={t("dashboardPage.kpi.expenses")} value={money(kpis.expenses.current)} footer={<MonthDelta {...kpis.expenses} />} />
      <StatTile label={t("dashboardPage.kpi.income")} value={money(kpis.income.current)} footer={<MonthDelta {...kpis.income} />} />
      <StatTile
        label={t("dashboardPage.kpi.net")}
        value={money(kpis.net.current)}
        marker={kpis.net.current < 0 && <NegativeMarker />}
        footer={<MonthDelta {...kpis.net} />}
      />
    </div>
  )
}
