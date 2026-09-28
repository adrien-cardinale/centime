import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createRouter, RouterProvider } from "@tanstack/react-router"
import { ThemeProvider } from "next-themes"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { AppBoot } from "@/components/startup/app-boot"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ApiError } from "@/lib/api"
import { setApi } from "@/lib/api/api-ref"
import { createApi } from "@/lib/api/create-api"
import { authQuery, notifyMutationSettled } from "@/lib/queries"
import { isDesktop } from "@/lib/runtime"
import { routeTree } from "./routeTree.gen"
import "./index.css"

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: handleQueryError }),
  mutationCache: new MutationCache({ onSuccess: notifyMutationSettled }),
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
  if (isDesktop || !(error instanceof ApiError) || error.status !== 401) return
  queryClient.setQueryData(authQuery.queryKey, { authenticated: false })
  void router.navigate({ to: "/login" })
}

async function startDesktopSync(): Promise<void> {
  if (!__CENTIME_DESKTOP__ || !isDesktop) return
  const { startSyncScheduler } = await import("@/lib/sync/sync-store")
  startSyncScheduler(queryClient)
}

let booted: Promise<void> | null = null

function boot(): Promise<void> {
  booted ??= (async () => {
    setApi(await createApi())
    await startDesktopSync()
  })().catch((error: unknown) => {
    booted = null
    throw error
  })
  return booted
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
          <AppBoot boot={boot}>
            <RouterProvider router={router} />
          </AppBoot>
          <Toaster richColors position="top-right" />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
)
