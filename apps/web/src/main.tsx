import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createRouter, RouterProvider } from "@tanstack/react-router"
import { ThemeProvider } from "next-themes"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ApiError } from "@/lib/api"
import { authQuery } from "@/lib/queries"
import { routeTree } from "./routeTree.gen"
import "./index.css"

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: handleQueryError }),
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
})

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: "intent",
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
})

function handleQueryError(error: Error): void {
  if (!(error instanceof ApiError) || error.status !== 401) return
  queryClient.setQueryData(authQuery.queryKey, { authenticated: false })
  void router.navigate({ to: "/login" })
}

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById("root")
if (!rootElement) throw new Error("Élément #root introuvable")

createRoot(rootElement).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <RouterProvider router={router} />
          <Toaster richColors position="top-right" />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
)
