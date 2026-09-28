import type { QueryClient } from "@tanstack/react-query"
import { createRootRouteWithContext, Link, Outlet } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { usePageTitle } from "@/hooks/use-page-title"

export type RouterContext = { queryClient: QueryClient }

export const Route = createRootRouteWithContext<RouterContext>()({
  component: Outlet,
  notFoundComponent: NotFound,
})

function NotFound() {
  usePageTitle("Page introuvable")
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-5xl font-semibold tracking-tight text-muted-foreground tabular-nums">404</p>
      <div className="space-y-1">
        <h1 className="text-lg font-medium">Page introuvable</h1>
        <p className="text-sm text-muted-foreground">Cette adresse ne correspond à aucune page de centime.</p>
      </div>
      <Button asChild>
        <Link to="/">Retour au tableau de bord</Link>
      </Button>
    </div>
  )
}
