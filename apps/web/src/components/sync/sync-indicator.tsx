import { useNavigate } from "@tanstack/react-router"
import { AlertTriangle, Check, CloudOff, RefreshCw } from "lucide-react"
import { SidebarMenuButton } from "@/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { describeSyncState } from "@/lib/sync/sync-labels"
import { type SyncState, syncNow, useSyncStore } from "@/lib/sync/sync-store"
import { cn } from "@/lib/utils"

function SyncIcon({ state }: { state: SyncState }) {
  if (state.status === "syncing") return <RefreshCw className="animate-spin" />
  if (!state.configured || state.status === "offline") return <CloudOff />
  if (state.status === "error") return <AlertTriangle className="text-destructive" />
  return <Check />
}

export default function SyncIndicator() {
  const state = useSyncStore()
  const navigate = useNavigate()
  const description = describeSyncState(state)

  const activate = () => {
    if (state.configured) void syncNow()
    else void navigate({ to: "/settings" })
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <SidebarMenuButton
          onClick={activate}
          aria-label={description}
          className={cn(state.status === "error" && "text-destructive")}
        >
          <SyncIcon state={state} />
          <span>Synchroniser</span>
        </SidebarMenuButton>
      </TooltipTrigger>
      <TooltipContent side="right">{description}</TooltipContent>
    </Tooltip>
  )
}
