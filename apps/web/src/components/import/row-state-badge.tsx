import type { ComponentProps } from "react"
import { Badge } from "@/components/ui/badge"
import type { RowState } from "@/lib/api"
import { rowStateLabels } from "@/lib/labels"

const rowStateVariants: Record<RowState, ComponentProps<typeof Badge>["variant"]> = {
  new: "default",
  duplicate: "secondary",
  pendingToBooked: "outline",
}

export function RowStateBadge({ state }: { state: RowState }) {
  return <Badge variant={rowStateVariants[state]}>{rowStateLabels[state]}</Badge>
}
