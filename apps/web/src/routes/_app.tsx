import { createFileRoute, type ErrorComponentProps, Outlet, useRouter } from "@tanstack/react-router"
import { RotateCw } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { AppSidebar } from "@/components/app-sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { useCurrentPageTitle, usePageTitle } from "@/hooks/use-page-title"
import i18n from "@/i18n"

export const Route = createFileRoute("/_app")({
  component: AppLayout,
  errorComponent: AppError,
})

function AppShell({ children }: { children: ReactNode }) {
  const title = useCurrentPageTitle()
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
          <SidebarTrigger className="-ml-1" />
          <span aria-hidden="true" className="truncate text-sm font-medium text-muted-foreground">
            {title}
          </span>
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}

function AppLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : i18n.t("errors.unexpected")
}

function AppError({ error }: ErrorComponentProps) {
  const router = useRouter()
  const { t } = useTranslation()
  usePageTitle(t("page.error.title"))
  return (
    <AppShell>
      <Card className="mx-auto max-w-lg">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="font-medium">{t("page.error.loadFailed")}</p>
          <p className="text-sm text-muted-foreground">{errorMessage(error)}</p>
          <Button variant="outline" onClick={() => void router.invalidate()}>
            <RotateCw />
            {t("errors.retry")}
          </Button>
        </CardContent>
      </Card>
    </AppShell>
  )
}
