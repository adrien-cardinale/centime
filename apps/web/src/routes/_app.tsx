import { createFileRoute, type ErrorComponentProps, Outlet, useRouter } from "@tanstack/react-router"
import { RotateCw } from "lucide-react"
import type { ReactNode } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { usePageTitle } from "@/hooks/use-page-title"

export const Route = createFileRoute("/_app")({
  component: AppLayout,
  errorComponent: AppError,
})

function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
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
  return error instanceof Error ? error.message : "Erreur inattendue"
}

function AppError({ error }: ErrorComponentProps) {
  const router = useRouter()
  usePageTitle("Erreur")
  return (
    <AppShell>
      <Card className="mx-auto max-w-lg">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="font-medium">Impossible de charger la page</p>
          <p className="text-sm text-muted-foreground">{errorMessage(error)}</p>
          <Button variant="outline" onClick={() => void router.invalidate()}>
            <RotateCw />
            Réessayer
          </Button>
        </CardContent>
      </Card>
    </AppShell>
  )
}
