import { type CsvColumnChoice, type CsvProfileInput, findCsvColumn } from "@centime/core"
import type { Control, FieldPathByValue } from "react-hook-form"
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { CsvProfileFormValues } from "@/lib/csv-profile-form"

export type CsvProfileControl = Control<CsvProfileFormValues, unknown, CsvProfileInput>

type TextFieldProps = {
  control: CsvProfileControl
  name: FieldPathByValue<CsvProfileFormValues, string>
  label: string
  placeholder?: string
  description?: string
}

export function TextField({ control, name, label, placeholder, description }: TextFieldProps) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input placeholder={placeholder} {...field} />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

type SelectFieldProps = {
  control: CsvProfileControl
  name: FieldPathByValue<CsvProfileFormValues, string>
  label: string
  options: Record<string, string>
}

export function SelectField({ control, name, label, options }: SelectFieldProps) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <Select value={field.value} onValueChange={field.onChange}>
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {Object.entries(options).map(([value, optionLabel]) => (
                <SelectItem key={value} value={value}>
                  {optionLabel}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

type ColumnFieldProps = {
  control: CsvProfileControl
  name: FieldPathByValue<CsvProfileFormValues, string>
  label: string
  columns: CsvColumnChoice[]
  optional?: boolean
}

const NO_COLUMN = "__none__"

export function ColumnField({ control, name, label, columns, optional = false }: ColumnFieldProps) {
  if (columns.length === 0) return <TextField control={control} name={name} label={label} />

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const match = findCsvColumn(columns, field.value)
        const isMissing = field.value !== "" && !match
        return (
          <FormItem>
            <FormLabel>{label}</FormLabel>
            <Select
              value={match?.name ?? field.value}
              onValueChange={(value) => field.onChange(value === NO_COLUMN ? "" : value)}
            >
              <FormControl>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={optional ? "Aucune" : "Choisir une colonne"} />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {optional && <SelectItem value={NO_COLUMN}>Aucune</SelectItem>}
                {columns.map((column) => (
                  <SelectItem key={column.name} value={column.name}>
                    {column.name}
                    {column.sample && <span className="max-w-32 truncate text-muted-foreground">{column.sample}</span>}
                  </SelectItem>
                ))}
                {isMissing && <SelectItem value={field.value}>{field.value} (absente du fichier)</SelectItem>}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )
      }}
    />
  )
}
