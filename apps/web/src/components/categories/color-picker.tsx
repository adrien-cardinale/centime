import { CATEGORY_COLOR_PALETTE } from "@centime/core"
import { Check } from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"

type ColorPickerProps = {
  value: string | undefined
  onChange: (color: string) => void
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const { t } = useTranslation()
  const selected = value?.toLowerCase()

  return (
    <div className="flex flex-wrap gap-2">
      {CATEGORY_COLOR_PALETTE.map((color) => (
        <button
          key={color}
          type="button"
          aria-label={t("categories.colorPicker.color", { color })}
          aria-pressed={selected === color}
          onClick={() => onChange(color)}
          className={cn(
            "flex size-6 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition-shadow pointer-coarse:size-8 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            selected === color && "ring-2 ring-foreground",
          )}
          style={{ backgroundColor: color }}
        >
          {selected === color && <Check className="size-3.5 text-white" />}
        </button>
      ))}
    </div>
  )
}
