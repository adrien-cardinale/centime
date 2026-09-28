import { Check } from "lucide-react"
import { Input } from "@/components/ui/input"
import { CATEGORY_COLOR_PALETTE } from "@/lib/category-colors"
import { cn } from "@/lib/utils"

type ColorPickerProps = {
  value: string
  onChange: (color: string) => void
  id?: string
}

export function ColorPicker({ value, onChange, id }: ColorPickerProps) {
  const selected = value.toLowerCase()

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {CATEGORY_COLOR_PALETTE.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={`Couleur ${color}`}
            aria-pressed={selected === color}
            onClick={() => onChange(color)}
            className={cn(
              "flex size-7 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition-shadow focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              selected === color && "ring-2 ring-foreground",
            )}
            style={{ backgroundColor: color }}
          >
            {selected === color && <Check className="size-4 text-white" />}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span aria-hidden className="size-9 shrink-0 rounded-md border" style={{ backgroundColor: value }} />
        <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} className="font-mono" placeholder="#4a84c4" />
      </div>
    </div>
  )
}
