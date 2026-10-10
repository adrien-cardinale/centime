import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createRouter, RouterProvider } from "@tanstack/react-router"
import { ThemeProvider } from "next-themes"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { useTranslation } from "react-i18next"
import { AppBoot } from "@/components/startup/app-boot"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import "@/i18n"
import { setApi } from "@/lib/api/api-ref"
import { createApi } from "@/lib/api/create-api"
import { takePendingServerUrl } from "@/lib/account/accounts"
import { loadVault } from "@/lib/crypto/onboarding"
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
  basepath: import.meta.env.BASE_URL,
  context: { queryClient },
  defaultPreload: "intent",
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
})

async function startSync(accountId: string): Promise<void> {
  const serverUrl = await takePendingServerUrl(accountId)
  if (serverUrl !== null) await setServerUrl(serverUrl)
  startSyncScheduler(queryClient)
}

let booted: Promise<void> | null = null

function boot(): Promise<void> {
  booted ??= (async () => {
    const vault = await loadVault()
    setApi(await createApi(vault))
    await startSync(vault.credentials.userId)
  })().catch((error: unknown) => {
    booted = null
    throw error
  })
  return booted
}

function LocalizedRouter() {
  const { i18n } = useTranslation()
  // Le routeur est remonté au changement de langue pour que les libellés lus hors React soient relus.
  return <RouterProvider key={i18n.language} router={router} />
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
            <LocalizedRouter />
          </AppBoot>
          <Toaster
            richColors
            position="top-right"
            offset={{ top: "calc(env(safe-area-inset-top) + 24px)" }}
            mobileOffset={{ top: "calc(env(safe-area-inset-top) + 0.5rem)" }}
          />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
)
