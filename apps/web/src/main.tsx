import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createRouter, RouterProvider } from "@tanstack/react-router"
import { ThemeProvider } from "next-themes"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { AppBoot } from "@/components/startup/app-boot"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { setApi } from "@/lib/api/api-ref"
import { createApi } from "@/lib/api/create-api"
import { loadVault, takePendingServerUrl } from "@/lib/crypto/onboarding"
import { notifyMutationSettled } from "@/lib/queries"
import { setServerUrl, startSyncScheduler } from "@/lib/sync/sync-store"
import { routeTree } from "./routeTree.gen"
import "./index.css"

const queryClient = new QueryClient({
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

async function startSync(): Promise<void> {
  const serverUrl = takePendingServerUrl()
  if (serverUrl !== null) await setServerUrl(serverUrl)
  startSyncScheduler(queryClient)
}

let booted: Promise<void> | null = null

function boot(): Promise<void> {
  booted ??= (async () => {
    setApi(await createApi(await loadVault()))
    await startSync()
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
