import { Link } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type SummaryCardProps = {
  title: string
  to: "/budgets" | "/transactions"
  isEmpty: boolean
  emptyMessage: string
  children: ReactNode
}

export function SummaryCard({ title, to, isEmpty, emptyMessage, children }: SummaryCardProps) {
  const { t } = useTranslation()
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardAction>
          <Button variant="link" size="sm" className="h-auto px-0" asChild>
            <Link to={to}>{t("dashboardPage.seeAll")}</Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {isEmpty ? <p className="text-sm text-muted-foreground">{emptyMessage}</p> : children}
      </CardContent>
    </Card>
  )
}
