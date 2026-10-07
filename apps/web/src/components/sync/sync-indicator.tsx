import { format, parseISO } from "date-fns"
import { Cloud, CloudOff, RefreshCw } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { describeSyncState } from "@/lib/sync/sync-labels"
import { type SyncState, syncNow, useSyncStore } from "@/lib/sync/sync-store"
import { cn } from "@/lib/utils"

function isHealthy(state: SyncState): boolean {
  return state.configured && (state.status === "idle" || state.status === "syncing")
}

export default function SyncIndicator() {
  const state = useSyncStore()
  const { t } = useTranslation()
  const description = describeSyncState(state)
  const healthy = isHealthy(state)
  const lastTime = state.configured && state.lastAt ? format(parseISO(state.lastAt), "HH:mm") : null

  return (
    <div className="flex items-center gap-2 px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("flex min-w-0 flex-1 items-center gap-2 text-sm", state.configured && "group-data-[collapsible=icon]:hidden")}>
            {healthy ? (
              <Cloud role="img" aria-label={description} className="size-4 shrink-0" />
            ) : (
              <CloudOff role="img" aria-label={description} className="size-4 shrink-0" />
            )}
            {lastTime && <span className="truncate tabular-nums text-muted-foreground">{lastTime}</span>}
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">{description}</TooltipContent>
      </Tooltip>
      {state.configured && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              onClick={() => void syncNow()}
              disabled={state.status === "syncing"}
              aria-label={t("settings.sync.syncNow")}
            >
              <RefreshCw className={cn(state.status === "syncing" && "animate-spin")} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">{description}</TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}
