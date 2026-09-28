import { formatAmount } from "@/lib/format"
import { cn } from "@/lib/utils"

type AmountProps = {
  amount: number
  currency: string
  className?: string
}

export function Amount({ amount, currency, className }: AmountProps) {
  return (
    <span className={cn("tabular-nums whitespace-nowrap", amount < 0 && "text-destructive", className)}>
      {formatAmount(amount, currency)}
    </span>
  )
}
