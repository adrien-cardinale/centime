import { type IsoDate, isoDateOf } from "@centime/core"
import { endOfMonth, getMonth, getYear, parseISO } from "date-fns"
import { XIcon } from "lucide-react"
import type * as React from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getMonthLabels } from "@/lib/labels"
import { cn } from "@/lib/utils"

export type MonthBoundary = "start" | "end"

const YEAR_SPAN = 5
const EMPTY_PLACEHOLDER = "—"

type MonthPickerProps = Omit<React.ComponentProps<typeof SelectTrigger>, "children" | "value" | "onChange"> & {
  value: IsoDate | null
  onChange: (value: IsoDate | null) => void
  boundary: MonthBoundary
  allowEmpty?: boolean
}

function boundaryDateOf(year: number, month: number, boundary: MonthBoundary): IsoDate {
  const firstDay = new Date(year, month, 1)
  return isoDateOf(boundary === "start" ? firstDay : endOfMonth(firstDay))
}

export function monthBoundaryOf(date: IsoDate, boundary: MonthBoundary): IsoDate {
  const parsed = parseISO(date)
  return boundaryDateOf(getYear(parsed), getMonth(parsed), boundary)
}

function yearOptions(currentYear: number, selectedYear: number | null): number[] {
  const first = Math.min(currentYear - YEAR_SPAN, selectedYear ?? currentYear)
  const last = Math.max(currentYear + YEAR_SPAN, selectedYear ?? currentYear)
  return Array.from({ length: last - first + 1 }, (_, index) => first + index)
}

export function MonthPicker({ value, onChange, boundary, allowEmpty = false, ...triggerProps }: MonthPickerProps) {
  const { t } = useTranslation()
  const today = new Date()
  const selected = value ? parseISO(value) : null
  const month = selected ? getMonth(selected) : getMonth(today)
  const year = selected ? getYear(selected) : getYear(today)

  const clearable = allowEmpty && value !== null

  function select(nextYear: number, nextMonth: number) {
    onChange(boundaryDateOf(nextYear, nextMonth, boundary))
  }

  return (
    <div className={cn("grid gap-2", clearable ? "grid-cols-[1fr_auto_auto]" : "grid-cols-[1fr_auto]")}>
      <Select value={selected ? String(month) : ""} onValueChange={(next) => select(year, Number(next))}>
        <SelectTrigger className="w-full" {...triggerProps}>
          <SelectValue placeholder={EMPTY_PLACEHOLDER} />
        </SelectTrigger>
        <SelectContent>
          {getMonthLabels().map((label, index) => (
            <SelectItem key={label} value={String(index)}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={selected ? String(year) : ""} onValueChange={(next) => select(Number(next), month)}>
        <SelectTrigger aria-label={t("common.year")}>
          <SelectValue placeholder={EMPTY_PLACEHOLDER} />
        </SelectTrigger>
        <SelectContent>
          {yearOptions(getYear(today), selected ? year : null).map((option) => (
            <SelectItem key={option} value={String(option)}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {clearable && (
        <Button type="button" variant="ghost" size="icon" aria-label={t("common.clear")} onClick={() => onChange(null)}>
          <XIcon />
        </Button>
      )}
    </div>
  )
}
