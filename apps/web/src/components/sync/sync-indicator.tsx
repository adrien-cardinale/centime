import { format, parseISO } from "date-fns"
import { Cloud, CloudOff, RefreshCw } from "lucide-react"
import type * as React from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useIsMobile } from "@/hooks/use-mobile"
import { describeSyncState } from "@/lib/sync/sync-labels"
import { type SyncState, syncNow, useSyncStore } from "@/lib/sync/sync-store"
import { cn } from "@/lib/utils"

async function synchronizeNow(successMessage: (pulled: number, pushed: number) => string): Promise<void> {
  const outcome = await syncNow()
  if (outcome.ok) toast.success(successMessage(outcome.report.pulled, outcome.report.pushed))
  else toast.error(outcome.message)
}

function isHealthy(state: SyncState): boolean {
  return state.configured && (state.status === "idle" || state.status === "syncing")
}

type StatusSummaryProps = {
  state: SyncState
  description: string
  showDescription: boolean
}

function StatusIcon({ healthy, description }: { healthy: boolean; description: string }) {
  const Icon = healthy ? Cloud : CloudOff
  return <Icon role="img" aria-label={description} className="size-4 shrink-0" />
}

function StatusSummary({ state, description, showDescription, ...props }: StatusSummaryProps & React.ComponentProps<"div">) {
  const lastTime = state.configured && state.lastAt ? format(parseISO(state.lastAt), "HH:mm") : null
  return (
    <div
      className={cn("flex min-w-0 flex-1 items-center gap-2 text-sm", state.configured && "group-data-[collapsible=icon]:hidden")}
      {...props}
    >
      <StatusIcon healthy={isHealthy(state)} description={description} />
      {showDescription ? (
        <span aria-hidden="true" className="line-clamp-2 text-xs text-muted-foreground">
          {description}
        </span>
      ) : (
        lastTime && <span className="truncate tabular-nums text-muted-foreground">{lastTime}</span>
      )}
    </div>
  )
}

function DesktopTooltip({ enabled, content, children }: { enabled: boolean; content: string; children: React.ReactElement }) {
  if (!enabled) return children
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{content}</TooltipContent>
    </Tooltip>
  )
}

export default function SyncIndicator() {
  const state = useSyncStore()
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  const description = describeSyncState(state)

  return (
    <div className="flex items-center gap-2 px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
      <DesktopTooltip enabled={!isMobile} content={description}>
        <StatusSummary state={state} description={description} showDescription={isMobile} />
      </DesktopTooltip>
      {state.configured && (
        <DesktopTooltip enabled={!isMobile} content={description}>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            onClick={() => void synchronizeNow((pulled, pushed) => t("settings.sync.report", { pulled, pushed }))}
            disabled={state.status === "syncing"}
            aria-label={t("settings.sync.syncNow")}
          >
            <RefreshCw className={cn(state.status === "syncing" && "animate-spin")} />
          </Button>
        </DesktopTooltip>
      )}
    </div>
  )
}
