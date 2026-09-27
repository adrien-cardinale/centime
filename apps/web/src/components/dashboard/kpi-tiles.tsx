import type { DashboardKpis } from "@/lib/api"
import { money } from "@/lib/dashboard"
import { MonthDelta, NegativeMarker, StatTile } from "./stat-tile"

export function KpiTiles({ kpis }: { kpis: DashboardKpis }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatTile
        label="Solde bancaire"
        value={kpis.bankBalance === null ? "—" : money(kpis.bankBalance)}
        footer={kpis.bankBalance === null ? "Aucun solde disponible" : "Dernier solde connu des comptes bancaires"}
      />
      <StatTile label="Dépenses du mois" value={money(kpis.expenses.current)} footer={<MonthDelta {...kpis.expenses} />} />
      <StatTile label="Revenus du mois" value={money(kpis.income.current)} footer={<MonthDelta {...kpis.income} />} />
      <StatTile
        label="Net du mois"
        value={money(kpis.net.current)}
        marker={kpis.net.current < 0 && <NegativeMarker />}
        footer={<MonthDelta {...kpis.net} />}
      />
    </div>
  )
}
