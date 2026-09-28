import { Badge } from "@/components/ui/badge"
import { tintedBackground, tintedBorder } from "@/lib/category-colors"
import { cn } from "@/lib/utils"
import { ColorDot } from "./color-dot"

type CategoryBadgeProps = {
  name: string
  color: string
  className?: string
}

export function CategoryBadge({ name, color, className }: CategoryBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn("max-w-48 text-foreground", className)}
      style={{ backgroundColor: tintedBackground(color), borderColor: tintedBorder(color) }}
    >
      <ColorDot color={color} className="size-2" />
      <span className="truncate">{name}</span>
    </Badge>
  )
}
